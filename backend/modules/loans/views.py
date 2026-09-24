# Vistas del modulo loans.
# Aqui viven los endpoints CRUD y el flujo de firma electronica.

import datetime
import hashlib
import os
import random
import string
import uuid

import django_filters
import jwt
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from sia_api.emailing import send_sagi_email
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Loans, LoanDraft, SignOTP
from .serializers import LoanSerializer
from modules.permissions.permissions_drf import HasPermission, IsSuperUser
from modules.users.models import BlacklistedToken
from modules.audit.mixins import AuditMixin
from modules.audit.utils import log as audit_log
from modules.audit.models import AuditLog

# ─────────────────────────────────────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────────────────────────────────────
_SIGN_TOKEN_TTL_MINUTES = 60 * 4   # 4 h por enlace de firma
_OTP_RL_MAX    = 5
_OTP_RL_WINDOW = 60 * 15
_OTP_RL_MSG    = "Demasiadas solicitudes de código. Intenta nuevamente en 15 minutos."
_SIGN_RL_MAX    = 10
_SIGN_RL_WINDOW = 60 * 15
_SIGN_RL_MSG    = "Demasiados intentos de firma. Intenta nuevamente en 15 minutos."

# ─────────────────────────────────────────────────────────────────────────────
# Helpers de rate limiting
# ─────────────────────────────────────────────────────────────────────────────

def _client_ip(request) -> str:
    # Igual que en users/views.py: X-Forwarded-For lo escribe cualquiera,
    # así que solo vale si la conexión viene de un proxy en TRUSTED_PROXIES
    # (tomando la ÚLTIMA IP, la que agregó el proxy). Si no: REMOTE_ADDR.
    remote = (request.META.get("REMOTE_ADDR") or "unknown").split(",")[0].strip()
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        trusted = [p.strip() for p in os.getenv("TRUSTED_PROXIES", "").split(",") if p.strip()]
        if remote in trusted:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            if parts:
                return parts[-1]
    return remote


def _rl_key(request, prefix: str) -> str:
    return f"{prefix}_{_client_ip(request)}"

def _check_rl(request, prefix, max_attempts, msg):
    if cache.get(_rl_key(request, prefix), 0) >= max_attempts:
        return Response({"error": msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return None

def _record_rl(request, prefix, window):
    key = _rl_key(request, prefix)
    cache.add(key, 0, timeout=window)
    cache.incr(key)

def _reset_rl(request, prefix):
    cache.delete(_rl_key(request, prefix))

def _get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "")


def _is_valid_email(value: str) -> bool:
    """True si `value` es un correo con formato válido."""
    try:
        validate_email(value)
        return True
    except DjangoValidationError:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de token y correo
# ─────────────────────────────────────────────────────────────────────────────

def _build_sign_token(batch_id: str, role: str, user_id: int) -> str:
    """
    JWT de firma con batch_id (no loan_id individual).
    Un solo token cubre todos los préstamos del lote.
    Op.2: user_id embebido para validación triple.
    """
    payload = {
        "batch_id": str(batch_id),
        "role":     role,
        "user_id":  user_id,
        "scope":    "loan_sign",
        "exp":      datetime.datetime.utcnow() + datetime.timedelta(minutes=_SIGN_TOKEN_TTL_MINUTES),
        "iat":      datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _send_sign_email(user, loans_in_batch: list, role: str, token: str) -> None:
    """
    Envía UN SOLO correo de firma por persona, listando todos los materiales
    del lote. Sin importar cuántos préstamos tenga el lote.
    """
    sign_link  = f"{settings.FRONTEND_URL}/prestamos/firmar?token={token}"
    role_label = "responsable del préstamo" if role == "responsable" else "receptor del material"
    first_loan = loans_in_batch[0]

    materials = [(l.id_material.name, f"cantidad: {l.amount_lent}") for l in loans_in_batch]

    send_sagi_email(
        user.email,
        subject="Firma requerida — Préstamo de material SAGI",
        template="loan_sign.html",
        context={
            "greeting_name": user.first_name,
            "role_label": role_label,
            "validity_hours": _SIGN_TOKEN_TTL_MINUTES // 60,
            "button": {
                "label": "Firmar préstamo",
                "url": sign_link,
            },
            "materials": materials,
            "materials_title": "Materiales del préstamo",
            "details": [
                ("Grupo", first_loan.apprentice_group),
                ("Fecha", str(first_loan.loan_date)),
            ],
            "warning": "Al abrir el enlace se te pedirá un código de verificación que recibirás "
                       "en un correo separado en ese momento. Si no reconoces este préstamo, "
                       "avisa al administrador.",
        },
    )


def _send_otp_email(user, code: str, loans_in_batch: list) -> None:
    """Envía UN SOLO correo OTP que cubre todo el lote."""
    send_sagi_email(
        user.email,
        subject="Tu código de verificación de firma — SAGI",
        template="loan_sign_otp.html",
        context={
            "greeting_name": user.first_name,
            "code": code,
            "code_caption": f"Válido por {SignOTP.OTP_TTL_MINUTES} minutos y de un solo uso.",
            "materials": [(l.id_material.name, f"cantidad: {l.amount_lent}") for l in loans_in_batch],
            "materials_title": "Materiales",
            "warning": "Si no solicitaste este código, contacta al administrador de inmediato.",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# FilterSet
# ─────────────────────────────────────────────────────────────────────────────

class LoanFilter(django_filters.FilterSet):
    loan_date_after  = django_filters.DateFilter(field_name='loan_date', lookup_expr='gte')
    loan_date_before = django_filters.DateFilter(field_name='loan_date', lookup_expr='lte')

    class Meta:
        model  = Loans
        fields = {
            'state':               ['exact'],
            'apprentice_group':    ['exact', 'icontains'],
            'id_responsable_user': ['exact'],
            'id_receptor_user':    ['exact'],
        }


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet principal
# ─────────────────────────────────────────────────────────────────────────────

class LoanViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = LoanSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class  = LoanFilter
    search_fields    = ['apprentice_group', 'id_material__name', 'justification_use']
    ordering_fields  = ['loan_date', 'return_date', 'state', 'id_loan']

    def _user_is_admin(self):
        user = self.request.user
        if user.is_superuser:
            return True
        from modules.permissions.models import UserGroup
        return UserGroup.objects.filter(user=user, group__name__iexact='admin').exists()

    def get_queryset(self):
        base_qs = Loans.objects.select_related(
            'id_responsable_user', 'id_receptor_user', 'id_material',
            'id_material__returnablematerial',
            'signed_by_responsable', 'signed_by_receptor',
        ).order_by('id_loan')
        if self._user_is_admin():
            return base_qs
        user = self.request.user
        return base_qs.filter(Q(id_responsable_user=user) | Q(id_receptor_user=user))

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_loan")]
        if self.action == "create":
            return [HasPermission("create_loan")]
        if self.action in ("update", "partial_update"):
            return [HasPermission("edit_loan")]
        return [IsSuperUser()]

    def list(self, request, *args, **kwargs):
        # ?limit=N — para vistas de "recientes" (campana de notificaciones):
        # trae solo los N últimos sin transferir la tabla completa.
        limit = request.query_params.get("limit")
        if limit is not None:
            try:
                n = max(1, min(int(limit), 50))
            except (TypeError, ValueError):
                n = None
            if n:
                qs = (
                    self.filter_queryset(self.get_queryset())
                    .order_by("-loan_date", "-id_loan")[:n]
                )
                serializer = self.get_serializer(qs, many=True)
                return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    # ── create ────────────────────────────────────────────────────────────

    def _create_single(self, loan_data):
        serializer = self.get_serializer(data=loan_data)
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def _dispatch_batch_sign_emails(self, loans: list) -> None:
        """
        Genera UN token y envía UN correo de firma por rol (responsable/receptor),
        independientemente de cuántos préstamos tenga el lote.
        El token lleva batch_id, role y user_id (Op.2).
        """
        first = loans[0]
        batch_id = first.batch_id

        for role, user in [
            ("responsable", first.id_responsable_user),
            ("receptor",    first.id_receptor_user),
        ]:
            token = _build_sign_token(batch_id, role, user.id)
            try:
                _send_sign_email(user, loans, role, token)
            except Exception:
                pass   # fallo de correo no aborta la creación

    def create(self, request, *args, **kwargs):
        material_ids = request.data.get("id_material")
        batch = uuid.uuid4()   # UUID único para todo este lote

        # ── creación simple (un solo material) ────────────────────────────
        if not isinstance(material_ids, list):
            data = request.data.copy()
            data["batch_id"] = str(batch)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                loan = serializer.save(batch_id=batch)
            self._dispatch_batch_sign_emails([loan])
            return Response(self.get_serializer(loan).data, status=status.HTTP_201_CREATED)

        # ── creación múltiple ─────────────────────────────────────────────
        if not material_ids:
            return Response(
                {"id_material": ["Debe seleccionar al menos un material."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loan_amounts = request.data.get("amount_lent")
        if not isinstance(loan_amounts, dict) or any(
            str(mid) not in loan_amounts for mid in material_ids
        ):
            return Response(
                {"amount_lent": ["Debe indicar una cantidad para cada material."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loans = []
        with transaction.atomic():
            for material_id in material_ids:
                ld = request.data.copy()
                ld["id_material"] = material_id
                ld["amount_lent"] = loan_amounts.get(str(material_id))
                loan = self._create_single(ld)
                loan.batch_id = batch
                loan.save(update_fields=["batch_id"])
                loans.append(loan)

        # Un solo correo por rol para todo el lote
        self._dispatch_batch_sign_emails(loans)
        return Response(self.get_serializer(loans, many=True).data, status=status.HTTP_201_CREATED)

    # ── update / partial_update / destroy ────────────────────────────────

    def _check_loan_is_active(self, instance):
        if instance.state != 'Activo':
            return Response(
                {"error": (
                    f"Solo se pueden modificar préstamos en estado 'Activo'. "
                    f"Este préstamo está en estado '{instance.state}'."
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def _invalidate_pending_sign_tokens(self, loan):
        """
        Op.5: limpia OTPs activos y firmas parciales de todos los préstamos
        del mismo lote, luego reagenda los correos.
        """
        if loan.batch_id:
            batch_loans = Loans.objects.filter(batch_id=loan.batch_id)
            SignOTP.objects.filter(batch_id=loan.batch_id, used=False).delete()
            batch_loans.update(
                signed_by_responsable=None, signed_at_responsable=None,
                signed_ip_responsable=None, signed_ua_responsable=None,
                signed_by_receptor=None,    signed_at_receptor=None,
                signed_ip_receptor=None,    signed_ua_receptor=None,
            )
        else:
            SignOTP.objects.filter(loan=loan, used=False).delete()
            loan.signed_by_responsable = None
            loan.signed_at_responsable = None
            loan.signed_ip_responsable = None
            loan.signed_ua_responsable = None
            loan.signed_by_receptor    = None
            loan.signed_at_receptor    = None
            loan.signed_ip_receptor    = None
            loan.signed_ua_receptor    = None
            loan.save(update_fields=[
                'signed_by_responsable', 'signed_at_responsable',
                'signed_ip_responsable', 'signed_ua_responsable',
                'signed_by_receptor',    'signed_at_receptor',
                'signed_ip_receptor',    'signed_ua_receptor',
            ])

    def destroy(self, request, *args, **kwargs):
        from django.db.models import RestrictedError as DjRestrictedError
        instance = self.get_object()
        if instance.state == 'Pendiente':
            self._invalidate_pending_sign_tokens(instance)
        try:
            return super().destroy(request, *args, **kwargs)
        except DjRestrictedError:
            return Response(
                {"error": "No se puede eliminar este préstamo porque tiene devoluciones registradas asociadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        was_pending = instance.state == 'Pendiente'
        if not was_pending:
            error = self._check_loan_is_active(instance)
            if error:
                return error
        if was_pending:
            self._invalidate_pending_sign_tokens(instance)
        response = super().update(request, *args, **kwargs)
        if was_pending:
            instance.refresh_from_db()
            self._dispatch_batch_sign_emails([instance])
        return response

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        was_pending = instance.state == 'Pendiente'
        if not was_pending:
            error = self._check_loan_is_active(instance)
            if error:
                return error
        if was_pending:
            self._invalidate_pending_sign_tokens(instance)
        response = super().partial_update(request, *args, **kwargs)
        if was_pending:
            instance.refresh_from_db()
            self._dispatch_batch_sign_emails([instance])
        return response


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internos de firma (compartidos por los dos endpoints)
# ─────────────────────────────────────────────────────────────────────────────

def _decode_sign_token(raw_token):
    """
    Decodifica y valida básicamente el token de firma.
    Devuelve (payload, error_response).
    """
    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None, Response(
            {"error": "El enlace de firma ha expirado. Solicita uno nuevo al administrador."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except jwt.InvalidTokenError:
        return None, Response(
            {"error": "El enlace de firma no es válido."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if payload.get("scope") != "loan_sign":
        return None, Response(
            {"error": "El enlace no es válido para esta operación."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return payload, None


def _get_batch_loans(batch_id_str):
    """
    Devuelve (loans_qs, error_response) para un batch_id dado.
    """
    try:
        bid = uuid.UUID(batch_id_str)
    except (ValueError, AttributeError):
        return None, Response(
            {"error": "El enlace no es válido."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    loans = list(
        Loans.objects.select_related(
            'id_responsable_user', 'id_receptor_user', 'id_material'
        ).filter(batch_id=bid)
    )
    if not loans:
        return None, Response(
            {"error": "No se encontraron préstamos asociados al enlace."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return loans, None


def _verify_all_pending(loans):
    """Devuelve error_response si algún préstamo del lote ya no está Pendiente."""
    non_pending = [l for l in loans if l.state != 'Pendiente']
    if non_pending:
        return Response(
            {"error": "Uno o más préstamos del lote ya no están pendientes de firma."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def _verify_identity(request, loans, role):
    """Devuelve error_response si el usuario autenticado no es quien debe firmar."""
    expected_user = loans[0].id_responsable_user if role == "responsable" else loans[0].id_receptor_user
    # Un receptor externo no tiene User: el flujo legado (con sesion
    # obligatoria) no puede atenderlo — debe firmar por el flujo draft
    # (/api/loans/draft/sign/) con token + OTP. Sin este guard habria un 500.
    if expected_user is None or request.user.id != expected_user.id:
        return Response(
            {"error": "No tienes permiso para firmar este préstamo."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: solicitar OTP por lote
# ─────────────────────────────────────────────────────────────────────────────

class LoanSignRequestOTPView(APIView):
    """
    POST /api/loans/sign/request-otp/
    Body: { "token": "<jwt de firma>" }

    Genera y envía UN SOLO código OTP que cubre todo el lote.
    Rate-limited: máx 5 solicitudes por IP en 15 min.
    """

    def post(self, request):
        blocked = _check_rl(request, "otp_request", _OTP_RL_MAX, _OTP_RL_MSG)
        if blocked:
            return blocked

        raw_token = request.data.get("token")
        if not raw_token:
            return Response({"error": "El token es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        payload, err = _decode_sign_token(raw_token)
        if err:
            _record_rl(request, "otp_request", _OTP_RL_WINDOW)
            return err

        # Op.2 — user_id en token debe coincidir con la sesión
        if payload.get("user_id") != request.user.id:
            return Response(
                {"error": "El enlace de firma corresponde a otro usuario."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Token ya usado
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            return Response(
                {"error": "Este enlace ya fue utilizado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role     = payload.get("role")
        batch_id = payload.get("batch_id")

        if role not in ("responsable", "receptor"):
            return Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        loans, err = _get_batch_loans(batch_id)
        if err:
            return err

        err = _verify_all_pending(loans)
        if err:
            return err

        err = _verify_identity(request, loans, role)
        if err:
            return err

        # Invalidar OTPs previos no usados del mismo lote/rol
        SignOTP.objects.filter(batch_id=uuid.UUID(batch_id), user=request.user, role=role, used=False).delete()

        # Generar OTP de 6 dígitos
        code       = "".join(random.choices(string.digits, k=6))
        code_hash  = hashlib.sha256(code.encode()).hexdigest()
        expires_at = timezone.now() + datetime.timedelta(minutes=SignOTP.OTP_TTL_MINUTES)

        # Un solo registro OTP referencia el primer préstamo + batch_id
        SignOTP.objects.create(
            loan=loans[0],
            batch_id=uuid.UUID(batch_id),
            user=request.user,
            role=role,
            code_hash=code_hash,
            expires_at=expires_at,
        )

        try:
            _send_otp_email(request.user, code, loans)
        except Exception:
            return Response(
                {"error": "No se pudo enviar el código de verificación. Intenta nuevamente."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        _reset_rl(request, "otp_request")

        return Response(
            {
                "message": (
                    f"Código enviado a {request.user.email}. "
                    f"Válido por {SignOTP.OTP_TTL_MINUTES} minutos."
                ),
                "expires_in_minutes": SignOTP.OTP_TTL_MINUTES,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: confirmar firma con OTP (activa todo el lote)
# ─────────────────────────────────────────────────────────────────────────────

class LoanSignView(APIView):
    """
    POST /api/loans/sign/
    Body: { "token": "<jwt de firma>", "otp_code": "123456" }

    Valida triple coincidencia (sesión + user_id en token + OTP correcto),
    registra la firma en TODOS los préstamos del lote y los activa cuando
    ambas partes han firmado. Rate-limited. Registra IP y User-Agent.
    """

    def post(self, request):
        blocked = _check_rl(request, "sign_attempt", _SIGN_RL_MAX, _SIGN_RL_MSG)
        if blocked:
            return blocked

        raw_token = request.data.get("token")
        otp_code  = str(request.data.get("otp_code", "")).strip()

        if not raw_token or not otp_code:
            return Response(
                {"error": "El token y el código de verificación son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload, err = _decode_sign_token(raw_token)
        if err:
            _record_rl(request, "sign_attempt", _SIGN_RL_WINDOW)
            return err

        # Op.2 — user_id en token debe coincidir con la sesión
        if payload.get("user_id") != request.user.id:
            _record_rl(request, "sign_attempt", _SIGN_RL_WINDOW)
            return Response(
                {"error": "El enlace de firma corresponde a otro usuario."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Token ya usado
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            return Response(
                {"error": "Este enlace ya fue utilizado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role     = payload.get("role")
        batch_id = payload.get("batch_id")

        if role not in ("responsable", "receptor"):
            return Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        loans, err = _get_batch_loans(batch_id)
        if err:
            return err

        err = _verify_all_pending(loans)
        if err:
            return err

        err = _verify_identity(request, loans, role)
        if err:
            _record_rl(request, "sign_attempt", _SIGN_RL_WINDOW)
            return err

        # Validar OTP
        otp_record = (
            SignOTP.objects
            .filter(batch_id=uuid.UUID(batch_id), user=request.user, role=role, used=False)
            .order_by('-created_at')
            .first()
        )

        if otp_record is None or not otp_record.is_valid:
            _record_rl(request, "sign_attempt", _SIGN_RL_WINDOW)
            return Response(
                {"error": "El código no existe, expiró o fue invalidado. Solicita uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hashlib.sha256(otp_code.encode()).hexdigest() != otp_record.code_hash:
            otp_record.attempts += 1
            otp_record.save(update_fields=["attempts"])
            _record_rl(request, "sign_attempt", _SIGN_RL_WINDOW)
            remaining = SignOTP.OTP_MAX_ATTEMPTS - otp_record.attempts
            msg = (
                f"Código incorrecto. Te quedan {remaining} intento(s)."
                if remaining > 0
                else "Código incorrecto. Límite de intentos superado. Solicita uno nuevo."
            )
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        # ── Todo correcto: firmar todos los préstamos del lote ────────────
        now        = timezone.now()
        client_ip  = _get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]

        with transaction.atomic():
            update_fields = {}
            if role == "responsable":
                update_fields = dict(
                    signed_by_responsable=request.user,
                    signed_at_responsable=now,
                    signed_ip_responsable=client_ip,
                    signed_ua_responsable=user_agent,
                )
            else:
                update_fields = dict(
                    signed_by_receptor=request.user,
                    signed_at_receptor=now,
                    signed_ip_receptor=client_ip,
                    signed_ua_receptor=user_agent,
                )

            for loan in loans:
                for field, value in update_fields.items():
                    setattr(loan, field, value)
                # Recargar valores actuales del otro rol para evaluar both_signed
                loan.refresh_from_db(fields=[
                    'signed_by_responsable', 'signed_by_receptor',
                    'signed_at_responsable', 'signed_at_receptor',
                    'signed_ip_responsable', 'signed_ip_receptor',
                    'signed_ua_responsable', 'signed_ua_receptor',
                ])
                for field, value in update_fields.items():
                    setattr(loan, field, value)
                if loan.both_signed:
                    loan.state = 'Activo'
                loan.save()

            # Marcar OTP como usado
            otp_record.used = True
            otp_record.save(update_fields=["used"])

            # Invalidar el token de firma (uso único, blacklist)
            exp_ts     = payload.get("exp")
            expires_at = (
                datetime.datetime.fromtimestamp(exp_ts, tz=datetime.timezone.utc)
                if exp_ts
                else timezone.now() + datetime.timedelta(minutes=_SIGN_TOKEN_TTL_MINUTES)
            )
            BlacklistedToken.objects.get_or_create(
                token_hash=token_hash,
                defaults={"expires_at": expires_at},
            )

        _reset_rl(request, "sign_attempt")

        # Auditar la firma del lote
        first = loans[0]
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_LOANS,
            action=AuditLog.ACTION_SIGN_LOAN,
            target_id=first.pk,
            target_repr=(
                f"Lote {str(first.batch_id)[:8]}… — "
                f"{len(loans)} préstamo(s)"
            ),
            detail=(
                f"Rol: {'Responsable' if role == 'responsable' else 'Receptor'} | "
                f"IP: {client_ip} | "
                f"Activos: {all(l.state == 'Activo' for l in loans)}"
            ),
            request=request,
        )

        activated  = all(l.state == 'Activo' for l in loans)
        role_label = "Responsable" if role == "responsable" else "Receptor"
        n          = len(loans)
        return Response(
            {
                "message": (
                    f"Firma registrada correctamente como {role_label} "
                    f"para {n} préstamo(s). "
                    + ("Todos los préstamos del lote están ahora Activos."
                       if activated
                       else "En espera de la firma de la otra parte.")
                ),
                "state":    "Activo" if activated else "Pendiente",
                "batch_id": batch_id,
                "loans":    [l.id_loan for l in loans],
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helpers del flujo draft (compartidos por los tres endpoints nuevos)
# ─────────────────────────────────────────────────────────────────────────────

def _build_draft_sign_token(batch_id: str, role: str, user_id, external: bool = False) -> str:
    """JWT de firma para el flujo draft. scope='loan_draft_sign'.

    user_id es None y external=True cuando el receptor no está registrado en
    el sistema — firma sin cuenta, probada solo con este token + el OTP
    enviado a su correo (ver get_permissions() en las vistas de firma).
    """
    payload = {
        "batch_id": str(batch_id),
        "role":     role,
        "user_id":  user_id,
        "external": external,
        "scope":    "loan_draft_sign",
        "exp":      datetime.datetime.utcnow() + datetime.timedelta(minutes=_SIGN_TOKEN_TTL_MINUTES),
        "iat":      datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _decode_draft_sign_token(raw_token):
    """Decodifica token draft. Devuelve (payload, error_response)."""
    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None, Response(
            {"error": "El enlace de firma ha expirado."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except jwt.InvalidTokenError:
        return None, Response(
            {"error": "El enlace de firma no es válido."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if payload.get("scope") != "loan_draft_sign":
        return None, Response(
            {"error": "El enlace no es válido para esta operación."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return payload, None


def _check_draft_token_user(payload, request, drafts):
    """Valida que quien llama sea el destinatario del token de firma draft.

    - Token externo (receptor no registrado, sin cuenta): no hay sesion que
      comparar. Basta con que el rol sea receptor y que el borrador tenga
      realmente receptor externo. Devuelve None si OK o un Response de error.
    - Token interno: el user_id del JWT debe coincidir con la sesion activa.
    """
    if payload.get("external"):
        if payload.get("role") != "receptor" or not drafts[0].is_receptor_external:
            return Response(
                {"error": "El enlace de firma no es válido para esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None
    if payload.get("user_id") != request.user.id:
        return Response(
            {"error": "El enlace de firma corresponde a otro usuario."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _get_draft_batch(batch_id_str):
    """Devuelve (drafts, error_response) para un batch_id dado."""
    try:
        bid = uuid.UUID(batch_id_str)
    except (ValueError, AttributeError):
        return None, Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

    drafts = list(
        LoanDraft.objects.select_related(
            'id_responsable_user', 'id_receptor_user', 'id_material'
        ).filter(batch_id=bid, state=LoanDraft.STATE_PENDING)
    )
    if not drafts:
        return None, Response(
            {"error": "No se encontraron borradores pendientes asociados al enlace."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return drafts, None


def _send_draft_sign_email(name: str, email: str, drafts: list, role: str, token: str, external: bool = False) -> None:
    """Correo de firma para el flujo draft.

    Recibe (name, email) en vez de un User: cuando el receptor no está
    registrado no hay ningún objeto User que leer.
    """
    sign_path  = "/prestamos/firmar-externo" if external else "/prestamos/firmar"
    sign_link  = f"{settings.FRONTEND_URL}{sign_path}?token={token}"
    role_label = "responsable del préstamo" if role == "responsable" else "receptor del material"
    first      = drafts[0]
    send_sagi_email(
        email,
        subject="Firma requerida — Préstamo de material SAGI",
        template="loan_draft_sign.html",
        context={
            "greeting_name": name,
            "role_label": role_label,
            "validity_hours": _SIGN_TOKEN_TTL_MINUTES // 60,
            "button": {
                "label": "Firmar solicitud",
                "url": sign_link,
            },
            "materials": [(d.id_material.name, f"cantidad: {d.amount_lent}") for d in drafts],
            "materials_title": "Materiales",
            "details": [
                ("Grupo", first.apprentice_group),
                ("Fecha solicitada", str(first.loan_date)),
            ],
            "warning": "Al abrir el enlace se te pedirá un código de verificación que recibirás "
                       "en un correo separado en ese momento. Si no reconoces esta solicitud, "
                       "avisa al administrador.",
        },
    )


def _send_draft_otp_email(name: str, email: str, code: str, drafts: list) -> None:
    """Correo OTP para el flujo draft. Recibe (name, email) — ver _send_draft_sign_email."""
    send_sagi_email(
        email,
        subject="Tu código de verificación de firma — SAGI",
        template="loan_draft_otp.html",
        context={
            "greeting_name": name,
            "code": code,
            "code_caption": f"Válido por {SignOTP.OTP_TTL_MINUTES} minutos y de un solo uso.",
            "materials": [(d.id_material.name, f"cantidad: {d.amount_lent}") for d in drafts],
            "materials_title": "Materiales",
            "warning": "Si no solicitaste este código, contacta al administrador de inmediato.",
        },
    )


def _validate_draft_stock(drafts: list):
    """
    Valida que haya stock suficiente para cada borrador del lote.
    Considera préstamos Activos y borradores Pending del mismo material.
    Devuelve None si todo está bien, o una lista de errores.
    """
    from django.db.models import Sum
    errors = []
    for draft in drafts:
        mat = draft.id_material
        if mat.quantity is None:
            continue   # material sin control de stock (devolutivo sin cantidad)

        # Préstamos reales activos
        real_lent = (
            Loans.objects.filter(id_material=mat, state__in=['Activo', 'Pendiente'])
            .aggregate(total=Sum('amount_lent'))['total'] or 0
        )
        # Borradores pendientes del mismo material (excluyendo los del propio lote)
        draft_lent = (
            LoanDraft.objects.filter(id_material=mat, state=LoanDraft.STATE_PENDING)
            .exclude(batch_id=draft.batch_id)
            .aggregate(total=Sum('amount_lent'))['total'] or 0
        )
        available = mat.quantity - real_lent - draft_lent
        if draft.amount_lent > available:
            errors.append(
                f'Solo quedan {available} unidades disponibles de "{mat.name}" '
                f'(stock: {mat.quantity}, préstamos activos: {real_lent}, '
                f'otros borradores: {draft_lent}).'
            )
    return errors or None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: estado del borrador (polling de firmas)
# ─────────────────────────────────────────────────────────────────────────────

class LoanDraftStatusView(APIView):
    """
    GET /api/loans/draft/<batch_id>/status/
    Devuelve cuántas firmas se han registrado sobre el lote de borradores.
    Usado por el frontend para hacer polling y saber cuándo ambas partes firmaron.
    """

    def get(self, request, batch_id):
        try:
            bid = uuid.UUID(str(batch_id))
        except (ValueError, AttributeError):
            return Response({"error": "batch_id inválido."}, status=status.HTTP_400_BAD_REQUEST)

        # Tomar el primer borrador del lote (todos comparten responsable/receptor)
        draft = (
            LoanDraft.objects.select_related('id_responsable_user', 'id_receptor_user')
            .filter(batch_id=bid)
            .first()
        )
        if not draft:
            return Response({"error": "No se encontró el borrador."}, status=status.HTTP_404_NOT_FOUND)

        # Se usa signed_at_* y no signed_by_*: un receptor externo no tiene
        # User (signed_by_receptor queda None) pero si deja signed_at_receptor.
        signed_responsable = draft.signed_at_responsable is not None
        signed_receptor    = draft.signed_at_receptor is not None
        signatures         = int(signed_responsable) + int(signed_receptor)

        return Response({
            "batch_id":           str(bid),
            "state":              draft.state,
            "signatures":         signatures,           # 0, 1 o 2
            "signed_responsable": signed_responsable,
            "signed_receptor":    signed_receptor,
            "responsable_name":   f"{draft.id_responsable_user.first_name} {draft.id_responsable_user.last_name}",
            "receptor_name":      draft.receptor_display_name,
            "committed":          draft.state == LoanDraft.STATE_COMMITTED,
            "committed_loan_id":  draft.committed_loan_id,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: crear borrador de préstamo y enviar correos de firma
# ─────────────────────────────────────────────────────────────────────────────

class LoanDraftCreateView(APIView):
    """
    POST /api/loans/draft/
    Crea uno o varios borradores de préstamo (multi-material) y envía los
    correos de firma a responsable y receptor.
    El préstamo real NO se crea hasta que ambas partes firmen.
    """

    def get_permissions(self):
        return [HasPermission("create_loan")]

    def post(self, request):
        data         = request.data
        material_ids = data.get("id_material")
        loan_amounts = data.get("amount_lent", {})

        responsable_id = data.get("id_responsable_user")
        receptor_id    = data.get("id_receptor_user")
        group          = data.get("apprentice_group", "").strip()
        justification  = data.get("justification_use", "").strip()
        return_date    = data.get("return_date")
        loan_type      = data.get("loan_type")

        # Checkbox "¿El receptor está registrado en el sistema?" — cuando es
        # false se exige receptor_name/receptor_email en vez de id_receptor_user.
        receptor_is_registered = data.get("receptor_is_registered", True)
        if isinstance(receptor_is_registered, str):
            receptor_is_registered = receptor_is_registered.strip().lower() not in ("false", "0", "")
        receptor_name  = (data.get("receptor_name") or "").strip()
        receptor_email = (data.get("receptor_email") or "").strip()

        # ── Validación básica de campos requeridos ────────────────────────
        field_errors = {}
        if not responsable_id:
            field_errors["id_responsable_user"] = "Este campo es obligatorio."
        if receptor_is_registered:
            if not receptor_id:
                field_errors["id_receptor_user"] = "Este campo es obligatorio."
        else:
            if not receptor_name:
                field_errors["receptor_name"] = "Este campo es obligatorio."
            if not receptor_email:
                field_errors["receptor_email"] = "Este campo es obligatorio."
            elif not _is_valid_email(receptor_email):
                field_errors["receptor_email"] = "Debe ingresar un correo electrónico válido."
        if loan_type not in dict(Loans.LOAN_TYPE):
            field_errors["loan_type"] = "Debe seleccionar un tipo de préstamo válido (Interno o Externo)."
        # `apprentice_group` (Numero de grupo o ficha) es OPCIONAL: el frontend
        # ya no lo exige y se guarda vacio ("") si el usuario no lo llena.
        # No validamos nada aqui para evitar 400 espurios cuando el cliente
        # envia string vacio.
        if not justification:
            field_errors["justification_use"] = "Este campo es obligatorio."
        if not return_date:
            field_errors["return_date"] = "Este campo es obligatorio."

        if not material_ids or (isinstance(material_ids, list) and len(material_ids) == 0):
            field_errors["id_material"] = "Debe seleccionar al menos un material."
        elif isinstance(material_ids, list):
            if not isinstance(loan_amounts, dict) or any(
                str(mid) not in loan_amounts for mid in material_ids
            ):
                field_errors["amount_lent"] = "Debe indicar una cantidad para cada material."

        if field_errors:
            return Response(field_errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Normalizar lista de materiales ────────────────────────────────
        if not isinstance(material_ids, list):
            material_ids  = [material_ids]
            loan_amounts  = {str(material_ids[0]): loan_amounts}

        # ── Cargar entidades ──────────────────────────────────────────────
        from django.contrib.auth import get_user_model
        from modules.products.models import ConsumableMaterial
        User = get_user_model()

        try:
            responsable = User.objects.get(pk=responsable_id)
        except User.DoesNotExist:
            return Response({"id_responsable_user": "Usuario no encontrado."}, status=status.HTTP_400_BAD_REQUEST)

        if receptor_is_registered:
            try:
                receptor = User.objects.get(pk=receptor_id)
            except User.DoesNotExist:
                return Response({"id_receptor_user": "Usuario no encontrado."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            receptor = None

        materials = {}
        for mid in material_ids:
            try:
                mat = ConsumableMaterial.objects.get(pk=mid)
                if not mat.is_active:
                    return Response(
                        {"id_material": f'El material "{mat.name}" está deshabilitado y no puede prestarse.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                materials[str(mid)] = mat
            except ConsumableMaterial.DoesNotExist:
                return Response({"id_material": f"Material {mid} no encontrado."}, status=status.HTTP_400_BAD_REQUEST)

        # ── Crear borradores en memoria para validar stock ────────────────
        batch   = uuid.uuid4()
        ttl     = datetime.timedelta(hours=LoanDraft.DRAFT_TTL_HOURS)
        expires = timezone.now() + ttl

        draft_objs = []
        for mid in material_ids:
            try:
                amount = int(loan_amounts[str(mid)])
            except (ValueError, TypeError):
                return Response(
                    {"amount_lent": f"Cantidad inválida para el material {mid}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if amount < 1:
                return Response(
                    {"amount_lent": "La cantidad debe ser al menos 1."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            draft_objs.append(LoanDraft(
                batch_id          = batch,
                id_responsable_user = responsable,
                id_receptor_user  = receptor,
                receptor_name     = None if receptor_is_registered else receptor_name,
                receptor_email    = None if receptor_is_registered else receptor_email,
                id_material       = materials[str(mid)],
                amount_lent       = amount,
                apprentice_group  = group,
                loan_type         = loan_type,
                justification_use = justification,
                return_date       = return_date,
                expires_at        = expires,
            ))

        # ── Validar stock antes de persistir ─────────────────────────────
        stock_errors = _validate_draft_stock(draft_objs)
        if stock_errors:
            return Response({"amount_lent": stock_errors}, status=status.HTTP_400_BAD_REQUEST)

        # ── Persistir borradores ──────────────────────────────────────────
        with transaction.atomic():
            LoanDraft.objects.bulk_create(draft_objs)

        # Recargar para tener PKs y relaciones completas
        saved_drafts = list(
            LoanDraft.objects.select_related(
                'id_responsable_user', 'id_receptor_user', 'id_material'
            ).filter(batch_id=batch)
        )

        # ── Enviar correos de firma ───────────────────────────────────────
        # El responsable siempre es un usuario registrado; el receptor puede
        # no serlo — en ese caso no hay User que leer, se usan los datos
        # sueltos capturados en el formulario.
        sign_targets = [("responsable", responsable.first_name, responsable.email, responsable.id, False)]
        if receptor_is_registered:
            sign_targets.append(("receptor", receptor.first_name, receptor.email, receptor.id, False))
        else:
            sign_targets.append(("receptor", receptor_name, receptor_email, None, True))

        for role, name, email, user_id, external in sign_targets:
            token = _build_draft_sign_token(str(batch), role, user_id, external=external)
            try:
                _send_draft_sign_email(name, email, saved_drafts, role, token, external=external)
            except Exception:
                pass   # correo fallido no aborta — el admin puede reenviar

        return Response(
            {
                "batch_id":    str(batch),
                "message":     "Solicitud de préstamo creada. Se enviaron correos de firma a ambas partes.",
                "draft_count": len(saved_drafts),
                "expires_at":  expires.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: solicitar OTP para borrador
# ─────────────────────────────────────────────────────────────────────────────

class LoanDraftSignRequestOTPView(APIView):
    """
    POST /api/loans/draft/sign/request-otp/
    Body: { "token": "<jwt draft_sign>" }
    Genera y envía el OTP para confirmar la firma sobre el borrador.
    """

    def get_permissions(self):
        # Un receptor externo no tiene cuenta ni sesión — su identidad la
        # prueba únicamente este token (firmado por el servidor) + el OTP
        # que se le envía a su correo. El flag "external" viene del propio
        # JWT, así que no se puede falsificar desde el cliente.
        raw_token = self.request.data.get("token")
        if raw_token:
            payload, _ = _decode_draft_sign_token(raw_token)
            if payload and payload.get("role") == "receptor" and payload.get("external"):
                return [AllowAny()]
        return super().get_permissions()

    def post(self, request):
        blocked = _check_rl(request, "draft_otp_req", _OTP_RL_MAX, _OTP_RL_MSG)
        if blocked:
            return blocked

        raw_token = request.data.get("token")
        if not raw_token:
            return Response({"error": "El token es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        payload, err = _decode_draft_sign_token(raw_token)
        if err:
            _record_rl(request, "draft_otp_req", _OTP_RL_WINDOW)
            return err

        if payload.get("user_id") != request.user.id and not payload.get("external"):
            return Response(
                {"error": "El enlace de firma corresponde a otro usuario."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            return Response({"error": "Este enlace ya fue utilizado."}, status=status.HTTP_400_BAD_REQUEST)

        role     = payload.get("role")
        batch_id = payload.get("batch_id")

        if role not in ("responsable", "receptor"):
            return Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        drafts, err = _get_draft_batch(batch_id)
        if err:
            return err

        # El token dice a quien pertenece el enlace: externo (sin cuenta,
        # solo token + OTP) o interno (user_id == sesion). Ver helper.
        err = _check_draft_token_user(payload, request, drafts)
        if err:
            return err

        # Verificar que el borrador no haya expirado
        if drafts[0].is_expired:
            LoanDraft.objects.filter(batch_id=uuid.UUID(batch_id)).update(state=LoanDraft.STATE_EXPIRED)
            return Response(
                {"error": "La solicitud de préstamo ha expirado. Crea una nueva."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar identidad — un receptor externo no tiene FK (expected es
        # None) y por lo tanto no hay identidad de sesión que comparar: el
        # token + el OTP a su correo ya son la prueba.
        expected = drafts[0].id_responsable_user if role == "responsable" else drafts[0].id_receptor_user
        if expected is not None and request.user.id != expected.id:
            return Response(
                {"error": "No tienes permiso para firmar esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verificar que este rol no haya firmado ya (por timestamp: un
        # receptor externo nunca tiene signed_by_* poblado).
        already_signed = (
            drafts[0].signed_at_responsable is not None if role == "responsable"
            else drafts[0].signed_at_receptor is not None
        )
        if already_signed:
            return Response(
                {"error": "Ya firmaste esta solicitud. Esperando la firma de la otra parte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Invalidar OTPs previos del mismo batch/rol
        SignOTP.objects.filter(
            batch_id=uuid.UUID(batch_id),
            user=request.user if request.user.is_authenticated else None,
            role=role, used=False,
        ).delete()

        # Generar OTP
        code       = "".join(random.choices(string.digits, k=6))
        code_hash  = hashlib.sha256(code.encode()).hexdigest()
        expires_at = timezone.now() + datetime.timedelta(minutes=SignOTP.OTP_TTL_MINUTES)

        # SignOTP necesita un loan FK; usamos None-safe: creamos un OTP "draft"
        # apuntando al primer draft usando loan=None workaround via batch_id only.
        # Como el modelo requiere loan, buscamos si ya existe un Loans con este
        # batch_id (no debería); si no, reutilizamos el campo batch_id directamente.
        # Solución: guardamos en loan el primer draft via un préstamo dummy... No.
        # La solución limpia: el SignOTP del draft NO necesita FK a Loans.
        # Usamos un campo batch_id + role sin loan apuntando a None.
        # SignOTP.loan es FK con on_delete=CASCADE — no permite null.
        # Por eso creamos un registro especial usando batch_id solamente via cache.
        cache_key  = f"draft_otp_{batch_id}_{role}"
        cache.set(cache_key, {
            "code_hash":  code_hash,
            "expires_at": expires_at.isoformat(),
            "attempts":   0,
            "user_id":    request.user.id,
        }, timeout=SignOTP.OTP_TTL_MINUTES * 60 + 30)

        # Receptor externo: no hay User que leer, se usa lo capturado en el draft.
        if role == "receptor" and drafts[0].is_receptor_external:
            otp_name, otp_email = drafts[0].receptor_display_name, drafts[0].receptor_contact_email
        else:
            otp_name, otp_email = request.user.first_name, request.user.email

        try:
            _send_draft_otp_email(otp_name, otp_email, code, drafts)
        except Exception:
            cache.delete(cache_key)
            return Response(
                {"error": "No se pudo enviar el código de verificación. Intenta nuevamente."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        _reset_rl(request, "draft_otp_req")
        return Response(
            {
                "message":          f"Código enviado a {otp_email}. Válido por {SignOTP.OTP_TTL_MINUTES} minutos.",
                "expires_in_minutes": SignOTP.OTP_TTL_MINUTES,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: confirmar firma del borrador con OTP → crea Loans al completarse
# ─────────────────────────────────────────────────────────────────────────────

class LoanDraftSignView(APIView):
    """
    POST /api/loans/draft/sign/
    Body: { "token": "<jwt draft_sign>", "otp_code": "123456" }

    Valida OTP (almacenado en cache), registra la firma en el borrador.
    Cuando ambas partes firman, crea los registros Loans reales y marca
    los borradores como 'committed'.
    """

    def get_permissions(self):
        # Ver comentario equivalente en LoanDraftSignRequestOTPView.
        raw_token = self.request.data.get("token")
        if raw_token:
            payload, _ = _decode_draft_sign_token(raw_token)
            if payload and payload.get("role") == "receptor" and payload.get("external"):
                return [AllowAny()]
        return super().get_permissions()

    def post(self, request):
        blocked = _check_rl(request, "draft_sign", _SIGN_RL_MAX, _SIGN_RL_MSG)
        if blocked:
            return blocked

        raw_token = request.data.get("token")
        otp_code  = str(request.data.get("otp_code", "")).strip()

        if not raw_token or not otp_code:
            return Response(
                {"error": "El token y el código de verificación son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload, err = _decode_draft_sign_token(raw_token)
        if err:
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return err

        if payload.get("user_id") != request.user.id and not payload.get("external"):
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return Response(
                {"error": "El enlace de firma corresponde a otro usuario."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            return Response({"error": "Este enlace ya fue utilizado."}, status=status.HTTP_400_BAD_REQUEST)

        role     = payload.get("role")
        batch_id = payload.get("batch_id")

        if role not in ("responsable", "receptor"):
            return Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        drafts, err = _get_draft_batch(batch_id)
        if err:
            return err

        # El token dice a quien pertenece el enlace: externo (sin cuenta,
        # solo token + OTP) o interno (user_id == sesion). Ver helper.
        err = _check_draft_token_user(payload, request, drafts)
        if err:
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return err

        if drafts[0].is_expired:
            LoanDraft.objects.filter(batch_id=uuid.UUID(batch_id)).update(state=LoanDraft.STATE_EXPIRED)
            return Response(
                {"error": "La solicitud de préstamo ha expirado. Crea una nueva."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected = drafts[0].id_responsable_user if role == "responsable" else drafts[0].id_receptor_user
        if expected is not None and request.user.id != expected.id:
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return Response(
                {"error": "No tienes permiso para firmar esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verificar que este rol no haya firmado ya (por timestamp: un
        # receptor externo nunca tiene signed_by_* poblado).
        already_signed = (
            drafts[0].signed_at_responsable is not None if role == "responsable"
            else drafts[0].signed_at_receptor is not None
        )
        if already_signed:
            return Response(
                {"error": "Ya firmaste esta solicitud. Esperando la firma de la otra parte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validar OTP desde cache ───────────────────────────────────────
        cache_key  = f"draft_otp_{batch_id}_{role}"
        otp_entry  = cache.get(cache_key)

        if otp_entry is None:
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return Response(
                {"error": "El código no existe o ha expirado. Solicita uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_entry.get("user_id") != request.user.id:
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return Response({"error": "El código no corresponde a tu usuario."}, status=status.HTTP_403_FORBIDDEN)

        expires_dt = datetime.datetime.fromisoformat(otp_entry["expires_at"])
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=datetime.timezone.utc)
        if timezone.now() > expires_dt:
            cache.delete(cache_key)
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            return Response(
                {"error": "El código ha expirado. Solicita uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts = otp_entry.get("attempts", 0)
        if attempts >= SignOTP.OTP_MAX_ATTEMPTS:
            cache.delete(cache_key)
            return Response(
                {"error": "Límite de intentos superado. Solicita un nuevo código."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hashlib.sha256(otp_code.encode()).hexdigest() != otp_entry["code_hash"]:
            otp_entry["attempts"] = attempts + 1
            remaining = SignOTP.OTP_MAX_ATTEMPTS - otp_entry["attempts"]
            ttl_left  = int((expires_dt - timezone.now()).total_seconds())
            cache.set(cache_key, otp_entry, timeout=max(ttl_left, 1))
            _record_rl(request, "draft_sign", _SIGN_RL_WINDOW)
            msg = (
                f"Código incorrecto. Te quedan {remaining} intento(s)."
                if remaining > 0
                else "Código incorrecto. Límite de intentos superado. Solicita uno nuevo."
            )
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        # ── OTP correcto: registrar firma en todos los borradores del lote ─
        now        = timezone.now()
        client_ip  = _get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]

        # request.user es AnonymousUser cuando el receptor es externo — no es
        # una instancia real de User, así que no se puede asignar a la FK
        # signed_by_*. Su firma queda igualmente probada por signed_at_*.
        # Un token externo nunca atribuye firma a una sesion (aunque alguien
        # logueado abra el enlace): el firmante es el dueño del correo.
        is_external = bool(payload.get("external"))
        signer = None if is_external else (request.user if request.user.is_authenticated else None)

        sign_fields = {}
        if role == "responsable":
            sign_fields = dict(
                signed_by_responsable = signer,
                signed_at_responsable = now,
                signed_ip_responsable = client_ip,
                signed_ua_responsable = user_agent,
            )
        else:
            sign_fields = dict(
                signed_by_receptor = signer,
                signed_at_receptor = now,
                signed_ip_receptor = client_ip,
                signed_ua_receptor = user_agent,
            )

        with transaction.atomic():
            for draft in drafts:
                for field, value in sign_fields.items():
                    setattr(draft, field, value)
                draft.save()

            # Recargar para evaluar both_signed con los datos persistidos
            drafts = list(
                LoanDraft.objects.select_related(
                    'id_responsable_user', 'id_receptor_user', 'id_material'
                ).filter(batch_id=uuid.UUID(batch_id), state=LoanDraft.STATE_PENDING)
            )

            all_signed = all(d.both_signed for d in drafts)
            created_loans = []

            if all_signed:
                # ── Crear los préstamos reales ────────────────────────────
                batch_uuid = uuid.UUID(batch_id)
                for draft in drafts:
                    loan = Loans.objects.create(
                        batch_id            = batch_uuid,
                        id_responsable_user = draft.id_responsable_user,
                        id_receptor_user    = draft.id_receptor_user,
                        receptor_name       = draft.receptor_name,
                        receptor_email      = draft.receptor_email,
                        id_material         = draft.id_material,
                        amount_lent         = draft.amount_lent,
                        apprentice_group    = draft.apprentice_group,
                        loan_type           = draft.loan_type,
                        justification_use   = draft.justification_use,
                        return_date         = draft.return_date,
                        state               = 'Activo',
                        # Copiar trazabilidad de firmas
                        signed_by_responsable  = draft.signed_by_responsable,
                        signed_at_responsable  = draft.signed_at_responsable,
                        signed_ip_responsable  = draft.signed_ip_responsable,
                        signed_ua_responsable  = draft.signed_ua_responsable,
                        signed_by_receptor     = draft.signed_by_receptor,
                        signed_at_receptor     = draft.signed_at_receptor,
                        signed_ip_receptor     = draft.signed_ip_receptor,
                        signed_ua_receptor     = draft.signed_ua_receptor,
                    )
                    draft.committed_loan_id = loan.id_loan
                    draft.state             = LoanDraft.STATE_COMMITTED
                    draft.save(update_fields=['committed_loan_id', 'state'])
                    created_loans.append(loan)

            # Invalidar token de firma (uso único)
            exp_ts     = payload.get("exp")
            expires_at = (
                datetime.datetime.fromtimestamp(exp_ts, tz=datetime.timezone.utc)
                if exp_ts else now + datetime.timedelta(minutes=_SIGN_TOKEN_TTL_MINUTES)
            )
            BlacklistedToken.objects.get_or_create(
                token_hash=token_hash,
                defaults={"expires_at": expires_at},
            )

        # Limpiar OTP del cache
        cache.delete(cache_key)
        _reset_rl(request, "draft_sign")

        # Auditoría
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_LOANS,
            action=AuditLog.ACTION_SIGN_LOAN,
            target_id=drafts[0].pk,
            target_repr=f"Draft lote {str(batch_id)[:8]}… — {len(drafts)} ítem(s)",
            detail=(
                f"Rol: {'Responsable' if role == 'responsable' else 'Receptor'} | "
                f"IP: {client_ip} | "
                f"Comprometido: {all_signed}"
            ),
            request=request,
        )

        role_label = "Responsable" if role == "responsable" else "Receptor"
        if all_signed:
            return Response(
                {
                    "message": (
                        f"Firma registrada como {role_label}. "
                        f"Ambas partes firmaron. El préstamo ha sido creado y está Activo."
                    ),
                    "state":    "Activo",
                    "batch_id": batch_id,
                    "loans":    [l.id_loan for l in created_loans],
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "message": (
                        f"Firma registrada como {role_label}. "
                        f"El préstamo se creará cuando la otra parte también firme."
                    ),
                    "state":    "pending",
                    "batch_id": batch_id,
                },
                status=status.HTTP_200_OK,
            )

# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: listado de préstamos agrupados por lote (batch_id)
# ─────────────────────────────────────────────────────────────────────────────

class LoanBatchListView(APIView):
    """
    GET /api/loans/batches/
    Devuelve una lista de lotes de préstamos agrupados por batch_id.
    Cada lote incluye metadata del grupo y la lista de préstamos individuales.

    Estado agregado del lote:
      - 'Activo'     si algún loan del lote está Activo
      - 'Pendiente'  si algún loan está Pendiente (ninguno Activo)
      - 'Finalizado' si todos están Finalizado o Incompleto
    """

    def get_permissions(self):
        return [HasPermission("view_loan")]

    def _batch_state(self, loans):
        states = {l.state for l in loans}
        if 'Activo' in states:
            return 'Activo'
        if 'Pendiente' in states:
            return 'Pendiente'
        if states <= {'Finalizado', 'Incompleto'}:
            # Si hay al menos un Incompleto → Incompleto, si no → Finalizado
            return 'Incompleto' if 'Incompleto' in states else 'Finalizado'
        return loans[0].state

    def _user_is_admin(self, request):
        if request.user.is_superuser:
            return True
        from modules.permissions.models import UserGroup
        return UserGroup.objects.filter(
            user=request.user, group__name__iexact='admin'
        ).exists()

    def get(self, request):
        qs = Loans.objects.select_related(
            'id_responsable_user', 'id_receptor_user', 'id_material',
            'id_material__returnablematerial',
        ).order_by('batch_id', 'id_loan')

        if not self._user_is_admin(request):
            qs = qs.filter(
                Q(id_responsable_user=request.user) | Q(id_receptor_user=request.user)
            )

        # Agrupar por batch_id en Python (evita JOIN costoso y mantiene compatibilidad SQLite)
        from itertools import groupby
        batches = []
        for batch_id, group in groupby(qs, key=lambda l: l.batch_id):
            loans = list(group)
            first = loans[0]

            batch_state = self._batch_state(loans)

            loan_items = []
            for l in loans:
                is_returnable = hasattr(l.id_material, 'returnablematerial')
                loan_items.append({
                    'id_loan':       l.id_loan,
                    'material':      l.id_material.name,
                    'material_id':   l.id_material.id,
                    'material_type': 'devolutivo' if is_returnable else 'consumo',
                    'amount_lent':   l.amount_lent,
                    'state':         l.state,
                    'is_active':     l.state == 'Activo',
                })

            batches.append({
                'batch_id':            str(batch_id) if batch_id else None,
                'loan_date':           str(first.loan_date),
                'return_date':         str(first.return_date),
                'apprentice_group':    first.apprentice_group,
                'justification_use':   first.justification_use,
                'usuario_responsable': (
                    f"{first.id_responsable_user.first_name} {first.id_responsable_user.last_name}"
                ),
                'usuario_receptor': first.receptor_display_name,
                'state':       batch_state,
                'is_active':   batch_state == 'Activo',
                'loan_count':  len(loans),
                'loans':       loan_items,
            })

        # Ordenar: Activos primero, luego Pendientes, luego Finalizados
        ORDER = {'Activo': 0, 'Pendiente': 1, 'Finalizado': 2, 'Incompleto': 3}
        batches.sort(key=lambda b: (ORDER.get(b['state'], 9), b['loan_date']), reverse=False)

        return Response(batches, status=status.HTTP_200_OK)
