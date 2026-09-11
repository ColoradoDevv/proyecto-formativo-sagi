# Vistas del CRUD de usuarios.
import jwt
import hashlib
import secrets
import datetime
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models.functions import Lower

from .models import User, Role, DocumentType, BlacklistedToken, PasswordChangeOTP
from modules.permissions.models import UserGroup as PermUserGroup
from .serializers import UserSerializer
from .serializers import RoleSerializer
from .serializers import DocumentTypeSerializer
from .serializers import UserTrashSerializer
from .utils import generate_secure_password, send_welcome_email, send_password_change_otp_email, send_password_changed_confirmation_email
from modules.permissions.permissions_drf import HasPermission, is_primary_admin
from modules.audit.utils import log as audit_log
from modules.audit.models import AuditLog
from modules.audit.mixins import AuditMixin


# ---------------------------------------------------------------------------
# Helpers de protección contra fuerza bruta
# ---------------------------------------------------------------------------
_RATE_LIMIT_MAX      = 5          # intentos fallidos antes de bloquear
_RATE_LIMIT_WINDOW   = 60 * 15   # segundos de bloqueo (15 minutos)
_TOO_MANY_MSG        = "Demasiados intentos fallidos. Intenta nuevamente en 15 minutos."


def _rate_limit_key(request, prefix: str) -> str:
    """Genera la clave de caché para el contador de la IP del cliente."""
    ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
    # HTTP_X_FORWARDED_FOR puede contener una lista "ip1, ip2, ..."; tomamos la primera.
    ip = ip.split(",")[0].strip()
    return f"{prefix}_{ip}"


def _check_rate_limit(request, prefix: str):
    """
    Devuelve un Response 429 si la IP superó el límite, o None si puede continuar.
    No incrementa el contador — eso lo hace _record_failed_attempt().
    """
    key = _rate_limit_key(request, prefix)
    attempts = cache.get(key, 0)
    if attempts >= _RATE_LIMIT_MAX:
        return Response(
            {"error": _TOO_MANY_MSG},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    return None


def _record_failed_attempt(request, prefix: str) -> int:
    """
    Registra un intento fallido y devuelve el total acumulado.
    Usa add() para inicializar el TTL solo en el primer intento del ciclo.
    """
    key = _rate_limit_key(request, prefix)
    # cache.add() solo escribe si la clave no existe, preservando el TTL original.
    cache.add(key, 0, timeout=_RATE_LIMIT_WINDOW)
    attempts = cache.incr(key)
    return attempts


def _reset_rate_limit(request, prefix: str) -> None:
    """Elimina el contador tras un intento exitoso."""
    cache.delete(_rate_limit_key(request, prefix))


# ---------------------------------------------------------------------------

class MyProfileView(APIView):
    """Perfil del usuario autenticado, sin permisos administrativos."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        # Por ahora el perfil personal solo permite actualizar la foto. Los
        # demás campos siguen gestionándose desde el módulo de usuarios.
        if "profile_picture" not in request.FILES:
            return Response(
                {"profile_picture": ["Debes seleccionar una imagen."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # El SerializerMethodField solo lee; el campo de escritura se llama
        # profile_picture_upload (mismo source="profile_picture" en el modelo).
        data = {"profile_picture_upload": request.FILES["profile_picture"]}

        serializer = UserSerializer(
            request.user,
            data=data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RequestPasswordChangeOTPView(APIView):
    """
    Paso 1 del flujo de cambio de contraseña autenticado.

    Recibe: { current_password, new_password, confirm_new_password }
    Valida la contraseña actual y la política de la nueva, genera un OTP de
    6 dígitos, lo guarda hasheado y lo envía al correo del usuario.
    """

    def post(self, request):
        current_password    = request.data.get("current_password", "").strip()
        new_password        = request.data.get("new_password", "").strip()
        confirm_new_password = request.data.get("confirm_new_password", "").strip()

        # ── Validaciones básicas ────────────────────────────────────────────
        if not current_password or not new_password or not confirm_new_password:
            return Response(
                {"error": "Todos los campos son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(current_password, request.user.password):
            return Response(
                {"current_password": ["La contraseña actual es incorrecta."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_new_password:
            return Response(
                {"confirm_new_password": ["Las contraseñas no coinciden."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ResetPasswordView._password_is_valid(new_password):
            return Response(
                {"new_password": [
                    "La contraseña debe tener mínimo 10 caracteres e incluir "
                    "mayúscula, minúscula, número y carácter especial."
                ]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if check_password(new_password, request.user.password):
            return Response(
                {"new_password": ["La nueva contraseña no puede ser igual a la actual."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Generar OTP ─────────────────────────────────────────────────────
        # Invalidamos cualquier OTP previo sin usar para este usuario.
        PasswordChangeOTP.objects.filter(
            user=request.user, used=False
        ).update(used=True)

        raw_code  = f"{secrets.randbelow(900000) + 100000}"   # 6 dígitos
        code_hash = hashlib.sha256(raw_code.encode()).hexdigest()

        # Hasheamos la nueva contraseña ahora para no almacenarla en claro
        # y no pedirla de nuevo en el paso de confirmación.
        from django.contrib.auth.hashers import make_password
        pending_hash = make_password(new_password)

        PasswordChangeOTP.objects.create(
            user=request.user,
            code_hash=code_hash,
            pending_password_hash=pending_hash,
            expires_at=timezone.now() + datetime.timedelta(
                minutes=PasswordChangeOTP.OTP_TTL_MINUTES
            ),
        )

        # ── Enviar correo ───────────────────────────────────────────────────
        send_password_change_otp_email(request.user, raw_code)

        return Response(
            {"message": f"Código enviado a {request.user.email}. Válido por 10 minutos."},
            status=status.HTTP_200_OK,
        )


class ConfirmPasswordChangeView(APIView):
    """
    Paso 2 del flujo de cambio de contraseña autenticado.

    Recibe: { otp_code }
    Valida el código OTP y, si es correcto, aplica la nueva contraseña que
    fue almacenada en el paso 1 y envía un correo de confirmación.
    """

    def post(self, request):
        otp_code = request.data.get("otp_code", "").strip()

        if not otp_code:
            return Response(
                {"otp_code": ["El código de verificación es obligatorio."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code_hash = hashlib.sha256(otp_code.encode()).hexdigest()

        # Buscamos el OTP activo más reciente para este usuario.
        otp = (
            PasswordChangeOTP.objects.filter(user=request.user, used=False)
            .order_by("-created_at")
            .first()
        )

        if otp is None:
            return Response(
                {"otp_code": ["No hay ningún código de verificación activo. Solicita uno nuevo."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar intento y registrar el fallido antes de comparar
        # para evitar timing attacks que revelen si existe un OTP activo.
        if otp.attempts >= PasswordChangeOTP.OTP_MAX_ATTEMPTS:
            return Response(
                {"otp_code": ["Has superado el límite de intentos. Solicita un nuevo código."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp.expires_at:
            otp.used = True
            otp.save(update_fields=["used"])
            return Response(
                {"otp_code": ["El código ha expirado. Solicita uno nuevo."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.code_hash != code_hash:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = PasswordChangeOTP.OTP_MAX_ATTEMPTS - otp.attempts
            return Response(
                {"otp_code": [
                    f"Código incorrecto. Te quedan {remaining} intento(s)."
                    if remaining > 0
                    else "Has superado el límite de intentos. Solicita un nuevo código."
                ]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── OTP válido: aplicar la nueva contraseña ─────────────────────────
        otp.used = True
        otp.save(update_fields=["used"])

        request.user.password = otp.pending_password_hash
        request.user.must_change_password = False
        request.user.save(update_fields=["password", "must_change_password"])

        # Auditar cambio de contraseña autenticado
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_AUTH,
            action=AuditLog.ACTION_PASSWORD_CHANGE,
            target_id=request.user.pk,
            target_repr=f"{request.user.first_name} {request.user.last_name} <{request.user.email}>",
            detail="Cambio de contraseña confirmado vía OTP desde el perfil.",
            request=request,
        )

        # Enviar correo de confirmación de cambio exitoso
        send_password_changed_confirmation_email(request.user)

        return Response(
            {"message": "Contraseña actualizada correctamente."},
            status=status.HTTP_200_OK,
        )


class FirstLoginPasswordChangeView(APIView):
    """
    Cambio obligatorio de contraseña en el primer inicio de sesión.

    Recibe: { current_password, new_password, confirm_new_password }
    No requiere OTP: el usuario acaba de autenticarse con la contraseña temporal.
    """

    allow_during_password_change = True

    def post(self, request):
        if not request.user.must_change_password:
            return Response(
                {"error": "No es necesario cambiar la contraseña en este momento."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_password = request.data.get("current_password", "").strip()
        new_password = request.data.get("new_password", "").strip()
        confirm_new_password = request.data.get("confirm_new_password", "").strip()

        if not current_password or not new_password or not confirm_new_password:
            return Response(
                {"error": "Todos los campos son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(current_password, request.user.password):
            return Response(
                {"current_password": ["La contraseña actual es incorrecta."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_new_password:
            return Response(
                {"confirm_new_password": ["Las contraseñas no coinciden."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ResetPasswordView._password_is_valid(new_password):
            return Response(
                {"new_password": [
                    "La contraseña debe tener mínimo 10 caracteres e incluir "
                    "mayúscula, minúscula, número y carácter especial."
                ]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if check_password(new_password, request.user.password):
            return Response(
                {"new_password": ["La nueva contraseña no puede ser igual a la actual."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.must_change_password = False
        request.user.save(update_fields=["password", "must_change_password"])

        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_AUTH,
            action=AuditLog.ACTION_PASSWORD_CHANGE,
            target_id=request.user.pk,
            target_repr=f"{request.user.first_name} {request.user.last_name} <{request.user.email}>",
            detail="Cambio obligatorio de contraseña en el primer inicio de sesión.",
            request=request,
        )

        send_password_changed_confirmation_email(request.user)

        return Response(
            {
                "message": "Contraseña actualizada correctamente.",
                "must_change_password": False,
            },
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    # El login debe ser PUBLICO: nadie tiene token todavia al iniciar sesion.
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        # 1. Verificar si la IP está bloqueada por exceso de intentos fallidos
        blocked = _check_rate_limit(request, "login_attempts")
        if blocked:
            return blocked

        # 2. Validar que llegaron los dos datos
        if not email or not password:
            return Response(
                {"error": "Email y contraseña son obligatorios"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Buscar el usuario por email.
        # all_objects incluye eliminados para dar un mensaje apropiado en cada caso.
        try:
            user = User.all_objects.get(email=email)
        except User.DoesNotExist:
            _record_failed_attempt(request, "login_attempts")
            return Response(
                {"error": "Credenciales inválidas"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 4. Verificar la contraseña contra el hash guardado
        if not check_password(password, user.password):
            _record_failed_attempt(request, "login_attempts")
            return Response(
                {"error": "Credenciales inválidas"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 5. Verificar que la cuenta no esté eliminada ni desactivada
        if user.is_deleted:
            _record_failed_attempt(request, "login_attempts")
            return Response(
                {"error": "Esta cuenta ha sido eliminada"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            _record_failed_attempt(request, "login_attempts")
            return Response(
                {"error": "La cuenta está desactivada"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 6. Login exitoso — resetear contador de intentos fallidos
        _reset_rate_limit(request, "login_attempts")

        # Auditar inicio de sesión exitoso
        audit_log(
            actor=user,
            module=AuditLog.MODULE_AUTH,
            action=AuditLog.ACTION_LOGIN,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            request=request,
        )

        # 7. Construir el contenido del token (payload)
        payload = {
            "user_id": user.id,
            "email": user.email,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
            "iat": datetime.datetime.utcnow(),
        }

        # 8. Firmar el token con la clave secreta
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        # 9. Devolver el token y algunos datos utiles para el frontend
        # Obtener el primer grupo del usuario (si tiene)
        user_groups = user.user_groups.exclude(group__name__iexact="SADMIN")
        primary_group = user_groups.first().group.name if user_groups.exists() else None

        return Response({
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_superuser": user.is_superuser,  # Para que el frontend pueda usar usePermissions()
                "is_primary_admin": user.is_primary_admin,  # Protección del superadmin primigenio en UI
                "must_change_password": user.must_change_password,
                "role": primary_group,  # Devuelve el nombre del grupo principal
                "groups": [g.group.name for g in user_groups],  # Lista todos los grupos
            },
        })

class LogoutView(APIView):
    """
    Invalida el token JWT actual añadiéndolo a la blacklist.
    POST /api/users/logout/
    Header: Authorization: Bearer <token>
    """

    def post(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return Response(
                {"error": "No se proporcionó un token de autenticación."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_token = auth_header.split(" ")[1]

        # Decodificar sin verificar expiración para poder procesar tokens
        # que expiran exactamente en este instante.
        try:
            payload = jwt.decode(
                raw_token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
        except jwt.InvalidTokenError:
            return Response(
                {"error": "Token inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calcular hash SHA-256 del token crudo (nunca guardamos el token completo)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        # Obtener la fecha de expiración del claim 'exp'
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            expires_at = datetime.datetime.fromtimestamp(exp_timestamp, tz=datetime.timezone.utc)
        else:
            # Si no hay claim exp, fijamos expiración a 8h desde ahora (igual que LoginView)
            expires_at = timezone.now() + datetime.timedelta(hours=8)

        # Idempotente: si el token ya estaba en blacklist, logout sigue siendo exitoso
        BlacklistedToken.objects.get_or_create(
            token_hash=token_hash,
            defaults={"expires_at": expires_at},
        )

        # Auditar cierre de sesión
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_AUTH,
            action=AuditLog.ACTION_LOGOUT,
            target_id=request.user.pk,
            target_repr=f"{request.user.first_name} {request.user.last_name} <{request.user.email}>",
            request=request,
        )

        return Response(
            {"message": "Sesión cerrada correctamente."},
            status=status.HTTP_200_OK,
        )


class ForgetPasswordView(APIView):
    # Solicitar recuperacion de contrasena: tambien debe ser PUBLICO.
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")

        # 1. Verificar si la IP está bloqueada por exceso de solicitudes
        blocked = _check_rate_limit(request, "forgot_attempts")
        if blocked:
            return blocked

        # 2. Validar que llego el email
        if not email:
            return Response(
                {"error": "El email es obligatorio"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Respuesta generica: NO revelamos si el email existe o no.
        # Asi evitamos que alguien use este endpoint para descubrir cuentas.
        generic_response = Response(
            {"message": "Si el correo está registrado, enviaremos un enlace para restablecer la contraseña."},
            status=status.HTTP_200_OK,
        )

        # 4. Buscar el usuario. Si no existe (o esta inactivo), registramos el
        # intento (evita enumerar correos por timing) y respondemos igual.
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            _record_failed_attempt(request, "forgot_attempts")
            return generic_response

        if not user.is_active:
            return generic_response

        # 4. Construir un token de reset de vida corta (15 minutos según RFADMIN28).
        # El "scope" lo distingue del token de login para que no se pueda
        # reutilizar uno por el otro.
        payload = {
            "user_id": user.id,
            "scope": "password_reset",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
            "iat": datetime.datetime.utcnow(),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        # 5. Armar el enlace que apunta al frontend.
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

        # 6. Enviar el correo. fail_silently=False para que un fallo real
        # se vea en los logs durante el desarrollo.
        send_mail(
            subject="Restablece tu contraseña - SGI",
            message=(
                f"Hola {user.first_name},\n\n"
                "Recibimos una solicitud para restablecer tu contraseña.\n"
                f"Haz clic en el siguiente enlace para crear una nueva (válido por 15 minutos):\n\n"
                f"{reset_link}\n\n"
                "Si no solicitaste este cambio, puedes ignorar este correo."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        # 7. Solicitud legítima completada — resetear el contador de la IP
        _reset_rate_limit(request, "forgot_attempts")

        return generic_response


class ResetPasswordView(APIView):
    # Definir la nueva contrasena a partir del token enviado por correo.
    # Debe ser PUBLICO: el usuario aun no tiene sesion.
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        token = request.data.get("token")
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        # 1. Verificar si la IP está bloqueada por exceso de intentos de reset
        blocked = _check_rate_limit(request, "reset_attempts")
        if blocked:
            return blocked

        # 2. Validar que llegaron los datos
        if not token or not password or not confirm_password:
            return Response(
                {"error": "Token, contraseña y confirmación son obligatorios"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Ambas contrasenas deben coincidir
        if password != confirm_password:
            return Response(
                {"error": "Las contraseñas no coinciden"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Politica de complejidad: min 10, 1 mayus, 1 minus, 1 numero, 1 especial
        if not self._password_is_valid(password):
            return Response(
                {"error": "La contraseña debe tener mínimo 10 caracteres e incluir mayúscula, minúscula, número y carácter especial"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Verificar y decodificar el token (debe ser de scope password_reset)
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            _record_failed_attempt(request, "reset_attempts")
            return Response(
                {"error": "El enlace ha expirado (válido por 15 minutos). Solicita uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except jwt.InvalidTokenError:
            _record_failed_attempt(request, "reset_attempts")
            return Response(
                {"error": "El enlace no es válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if payload.get("scope") != "password_reset":
            _record_failed_attempt(request, "reset_attempts")
            return Response(
                {"error": "El enlace no es válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 5. Verificar que el token no haya sido usado ya (uso único)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            _record_failed_attempt(request, "reset_attempts")
            return Response(
                {"error": "Este enlace ya fue utilizado. Solicita uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 6. Buscar al usuario del token
        try:
            user = User.objects.get(id=payload["user_id"])
        except User.DoesNotExist:
            _record_failed_attempt(request, "reset_attempts")
            return Response(
                {"error": "El enlace no es válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 7. Guardar la nueva contrasena (hasheada) y confirmar
        user.set_password(password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])

        # 8. Invalidar el token para que no pueda reutilizarse
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            expires_at = datetime.datetime.fromtimestamp(
                exp_timestamp, tz=datetime.timezone.utc
            )
        else:
            expires_at = timezone.now() + datetime.timedelta(minutes=15)

        BlacklistedToken.objects.get_or_create(
            token_hash=token_hash,
            defaults={"expires_at": expires_at},
        )

        # 9. Reset exitoso: limpiar el contador de intentos de la IP
        _reset_rate_limit(request, "reset_attempts")

        # Auditar restablecimiento de contraseña vía correo
        audit_log(
            actor=user,
            module=AuditLog.MODULE_AUTH,
            action=AuditLog.ACTION_PASSWORD_RESET,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            detail="Contraseña restablecida vía enlace de correo.",
            request=request,
        )

        return Response(
            {"message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."},
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _password_is_valid(password):
        import re
        return (
            len(password) >= 10
            and re.search(r"[A-Z]", password)
            and re.search(r"[a-z]", password)
            and re.search(r"\d", password)
            and re.search(r"[^A-Za-z0-9]", password)
        )


class UserFilter(django_filters.FilterSet):
    """
    FilterSet personalizado para User.
    Soporta filtros exactos en campos directos y filtro por nombre de grupo
    (join con UserGroup → Group) que no es un campo directo del modelo.
    """
    first_name  = django_filters.CharFilter(lookup_expr='icontains')
    last_name   = django_filters.CharFilter(lookup_expr='icontains')
    document_number = django_filters.CharFilter(lookup_expr='icontains')
    is_active   = django_filters.BooleanFilter()
    is_accountable = django_filters.BooleanFilter()
    # ?group=Administrador  →  filtra por nombre del grupo vía UserGroup
    group = django_filters.CharFilter(
        field_name='user_groups__group__name',
        lookup_expr='iexact',
        label='Nombre del grupo',
    )

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'document_number', 'is_active', 'is_accountable', 'group']


class UserListCreateView(AuditMixin, generics.ListCreateAPIView):
    # Lista y crea usuarios.
    queryset = User.objects.all().order_by(Lower("first_name"))
    serializer_class = UserSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class  = UserFilter
    # ?search=  busca libremente en nombre, apellido, email y documento
    search_fields    = ['first_name', 'last_name', 'email', 'document_number']
    ordering_fields  = ['first_name', 'last_name', 'email', 'id']

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasPermission("create_user")]
        # GET (list) — cualquier usuario autenticado puede listar
        return [HasPermission("view_user")]


class UserDetailView(AuditMixin, generics.RetrieveUpdateDestroyAPIView):
    # Detalle: obtiene, actualiza y elimina un usuario.
    # Usa all_objects para que un administrador pueda acceder al registro
    # aunque esté marcado como eliminado (p.ej. para restaurarlo o auditarlo).
    queryset = User.all_objects.all()
    serializer_class = UserSerializer

    # Campos que no se pueden tocar en el admin primigenio bajo ninguna circunstancia.
    _PRIMARY_ADMIN_PROTECTED_FIELDS = {"is_active", "is_staff", "is_superuser", "is_primary_admin"}

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasPermission("view_user")]
        if self.request.method in ("PUT", "PATCH"):
            return [HasPermission("edit_user")]
        if self.request.method == "DELETE":
            return [HasPermission("delete_user")]
        return [HasPermission("view_user")]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if is_primary_admin(instance):
            # Rechazar si el body intenta tocar algún campo protegido.
            blocked = self._PRIMARY_ADMIN_PROTECTED_FIELDS & set(request.data.keys())
            if blocked:
                return Response(
                    {
                        "error": (
                            "No se pueden modificar los campos de acceso del "
                            "superadministrador primigenio del sistema."
                        ),
                        "fields": sorted(blocked),
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Protección: el admin primigenio no puede eliminarse (ni siquiera en forma lógica).
        if is_primary_admin(instance):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "No se puede eliminar al superadministrador primigenio del sistema."
            )
        # En vez de instance.delete(), hacemos un borrado logico: marcamos is_deleted y fecha.
        instance.soft_delete()  # metodo definido en el modelo User

class UserRolesListView(generics.ListAPIView):
    # Lista de roles para dropdowns, etc.
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer  
    
class UserDocumentTypesListView(generics.ListAPIView):
    # Lista de tipos de documento para dropdowns, etc.
    queryset = DocumentType.objects.all().order_by("name")
    serializer_class = DocumentTypeSerializer  

class UserTrashListView(generics.ListAPIView):
    # Lista de usuarios eliminados (papelera)
    queryset = User.all_objects.filter(is_deleted=True).order_by("-deleted_at")
    serializer_class = UserTrashSerializer

    def get_permissions(self):
        return [HasPermission("view_user")]


class UserRestoreView(APIView):
    # Restaura un usuario eliminado
    def get_permissions(self):
        return [HasPermission("edit_user")]

    def post(self, request, pk):
        user = User.all_objects.filter(pk=pk, is_deleted=True).first()
        if not user:
            return Response(
                {"error": "Usuario no encontrado en la papelera"},
                status=status.HTTP_404_NOT_FOUND,
            )
        user.restore()
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_USERS,
            action=AuditLog.ACTION_RESTORE,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            request=request,
        )
        return Response(
            {"mensaje": f"{user.first_name} {user.last_name} fue restaurado."},
            status=status.HTTP_200_OK,
        )
        
class ResendCredentialsView(APIView):
    # Genera una nueva contraseña para un usuario existente y se la reenvia por correo.
    # Util cuando el correo original no llego, fue a spam, o se corrigio un email mal escrito.

    def get_permissions(self):
        return [HasPermission("edit_user")]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_password = generate_secure_password()

        try:
            send_welcome_email(user, new_password)
        except Exception:
            return Response(
                {"error": "No se pudo enviar el correo. Verifica el correo del usuario e intenta nuevamente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Solo guardamos la nueva contrasena si el correo se envio con exito,
        # para no dejar al usuario con una contrasena que nadie conoce.
        user.set_password(new_password)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])

        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_USERS,
            action=AuditLog.ACTION_PASSWORD_RESET,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            detail="Credenciales reenviadas por un administrador.",
            request=request,
        )

        return Response(
            {"mensaje": f"Credenciales reenviadas a {user.email}"},
            status=status.HTTP_200_OK,
        )
