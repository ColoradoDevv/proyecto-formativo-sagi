#
# Workflow de aprobación de elevaciones (Fase 5a del sistema dinámico, diseño v3).
#
# Estados: BORRADOR → PENDIENTE → APROBADA | RECHAZADA | EXPIRADA |
# CANCELADA → ACTIVA. Sin workflow no hay N2/N3 para no primigenios;
# este módulo es el canal legítimo para esas elevaciones.
#

import hashlib
import json
import logging
import unicodedata
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.audit.models import AuditLog
from modules.audit.utils import log as audit_log
from sia_api.emailing import send_sagi_email
from .models import Group, GroupPermission, Permission, SolicitudCambioRol, UserGroup
from .ranking import action_level, classify_role_change, is_top, role_authority
from .serializers import GroupDetailSerializer
from .services import PermissionService


def canonical_hash(action, group_id, payload):
    """SHA256 canónico del contenido (anti aprobar A y terminar con A+)."""
    canonical = json.dumps(
        {"action": action, "group_id": group_id, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def proposed_role_data(solicitud):
    """Nivel y códigos propuestos según la acción.

    Retorna (level, [codenames]). CREATE: del payload (template + extras).
    UPDATE: nivel del grupo y resultante actual (para snapshot al enviar).
    """
    payload = solicitud.payload or {}
    if solicitud.action == SolicitudCambioRol.ACTION_CREATE_ROLE:
        try:
            level = int(payload.get("level", 900))
        except (TypeError, ValueError):
            level = 900
        codes = list(payload.get("perm_codenames", []) or [])
        template_id = payload.get("template_id")
        if template_id:
            try:
                template = Group.objects.get(pk=template_id)
                codes = list(template.permissions.values_list("codename", flat=True)) + codes
            except (Group.DoesNotExist, ValueError, TypeError):
                pass
        seen, unique = set(), []
        for code in codes:
            if code not in seen:
                seen.add(code)
                unique.append(code)
        return level, unique
    group = solicitud.group
    current = list(group.permissions.values_list("codename", flat=True)) if group else []
    add = payload.get("add", []) or []
    remove = set(payload.get("remove", []) or [])
    resulting = [c for c in current if c not in remove] + [c for c in add if c not in current]
    return (group.level if group else 900), resulting


def refresh_status(solicitud):
    """Expiración perezosa: PENDIENTE vencida → EXPIRADA."""
    if (
        solicitud.status == SolicitudCambioRol.STATUS_PENDIENTE
        and solicitud.expires_at
        and timezone.now() > solicitud.expires_at
    ):
        solicitud.status = SolicitudCambioRol.STATUS_EXPIRADA
        solicitud.save(update_fields=["status", "updated_at"])
    return solicitud.status


def approver_eligible(approver, solicitud, proposed_level):
    """Aprobador válido: activo, no solicitante, con approve_elevation y
    estrictamente superior al rol propuesto. N3 solo el Primigenio."""
    if not approver or not approver.is_authenticated or not approver.is_active:
        return False, "Aprobador no válido."
    if approver.pk == solicitud.requester_id:
        return False, "No puedes aprobar tu propia solicitud."
    if not PermissionService.has_permission(approver, "approve_elevation"):
        return False, "Requieres el permiso approve_elevation."
    if solicitud.security_level == "N3" and not is_top(approver):
        return False, "Nivel N3: solo el Primigenio puede decidir."
    approver_level = action_level(approver)
    if approver_level is not None and proposed_level <= approver_level:
        return False, "Debes ser estrictamente superior al rol propuesto."
    return True, ""


def check_step_up(approver, password):
    """Step-up temporal (Fase 5a): confirma la contraseña del aprobador."""
    if not password:
        return False
    return check_password(password, approver.password)


def check_step_up_totp(approver, totp_code):
    """Fase 7: el código TOTP reemplaza a la contraseña como step-up."""
    if not totp_code:
        return False
    from modules.users.mfa import verify_totp_code

    try:
        return verify_totp_code(approver, totp_code)
    except Exception:
        return False


def cancel_pending_for_group(group_id, reason="El rol cambió después de enviar."):
    """Invalida PENDIENTEs del grupo (anti A→A+). Retorna cuántas canceló."""
    pending = SolicitudCambioRol.objects.filter(
        group_id=group_id,
        action=SolicitudCambioRol.ACTION_UPDATE_ROLE_PERMS,
        status=SolicitudCambioRol.STATUS_PENDIENTE,
    )
    count = 0
    for solicitud in pending:
        solicitud.status = SolicitudCambioRol.STATUS_CANCELADA
        solicitud.decision_reason = reason
        solicitud.save(update_fields=["status", "decision_reason", "updated_at"])
        count += 1
    return count


logger = logging.getLogger(__name__)


def _inbox_url():
    from django.conf import settings

    base = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    return f"{base}/configuracion" if base else ""


def eligible_approvers(solicitud, proposed_level):
    """Aprobadores elegibles con email (para avisar al enviar).

    Temporal: solo el Primigenio (la bandeja está restringida hasta
    reabrir la visibilidad a superiores con approve_elevation).
    """
    User = get_user_model()
    return list(
        User.objects.filter(is_active=True, is_primary_admin=True).exclude(email="")
    )


def _send_safe(to_email, subject, template, context):
    """Notificar sin tumbar el flujo si el SMTP falla (se registra warning)."""
    try:
        send_sagi_email(to_email, subject, template, context)
    except Exception:
        logger.warning("No se pudo enviar correo a %s (%s)", to_email, subject)


def notify_on_submit(solicitud, proposed_level, codes):
    url = _inbox_url()
    for approver in eligible_approvers(solicitud, proposed_level):
        _send_safe(
            approver.email,
            f"[SAGI] Solicitud #{solicitud.pk} pendiente ({solicitud.security_level})",
            "elevation_submitted.html",
            {
                "paragraphs": [
                    f"Hola, {approver.first_name or approver.email}:",
                    f"{solicitud.requester.email} solicita {solicitud.get_action_display().lower()} "
                    f"(nivel {proposed_level}, {len(codes)} permisos).",
                ],
                "details": [
                    ["Solicitud", f"#{solicitud.pk}"],
                    ["Nivel de seguridad", solicitud.security_level],
                    ["Expira", f"{solicitud.expires_at:%Y-%m-%d %H:%M}"],
                ],
                "button": {"label": "Revisar solicitudes", "url": url} if url else None,
            },
        )


def notify_on_decision(solicitud, approved):
    requester = solicitud.requester
    if requester is None or not requester.email:
        return
    url = _inbox_url()
    _send_safe(
        requester.email,
        f"[SAGI] Solicitud #{solicitud.pk} {'aprobada' if approved else 'rechazada'}",
        "elevation_decided.html",
        {
            "paragraphs": [
                f"Hola, {requester.first_name or requester.email}:",
                f"Tu solicitud #{solicitud.pk} fue {'aprobada y aplicada' if approved else 'rechazada'}"
                + (f" por {solicitud.approver.email}." if solicitud.approver else "."),
            ],
            "details": [
                ["Estado", solicitud.status],
                ["Motivo", solicitud.decision_reason or "—"],
            ],
            "button": {"label": "Ver solicitudes", "url": url} if url else None,
        },
    )


class SolicitudCambioRolSerializer(serializers.ModelSerializer):
    requester_email = serializers.CharField(source="requester.email", read_only=True)
    approver_email = serializers.CharField(source="approver.email", read_only=True, default=None)

    class Meta:
        model = SolicitudCambioRol
        fields = [
            "id", "action", "group", "payload", "content_hash", "status",
            "security_level", "reason", "decision_reason",
            "requester", "requester_email", "approver", "approver_email",
            "expires_at", "decided_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "content_hash", "status", "security_level",
            "requester", "approver", "expires_at", "decided_at",
            "created_at", "updated_at",
        ]


class SolicitudViewSet(viewsets.ModelViewSet):
    """Solicitudes de elevación de roles (Fase 5a).

    - Crear/editar/cancelar borrador: el solicitante.
    - Ver: propias + pendientes que podrías aprobar (+ todo el Primigenio).
    - Aprobar/rechazar: elegible + step-up (contraseña).
    """

    serializer_class = SolicitudCambioRolSerializer
    permission_classes = [IsAuthenticated]
    queryset = SolicitudCambioRol.objects.select_related("requester", "approver", "group").all()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        # Temporal: la bandeja es solo del Primigenio. Los demás operan
        # únicamente sobre sus borradores propios (crear/enviar/cancelar);
        # ver y decidir ajeno queda reservado hasta reabrir la visibilidad.
        if is_top(user):
            return qs
        if self.action == "list":
            return qs.none()
        return qs.filter(requester=user)

    def perform_create(self, serializer):
        action = serializer.validated_data.get("action")
        if action not in (
            SolicitudCambioRol.ACTION_CREATE_ROLE, SolicitudCambioRol.ACTION_UPDATE_ROLE_PERMS
        ):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"action": "Acción no soportada."})
        group = serializer.validated_data.get("group")
        if action == SolicitudCambioRol.ACTION_UPDATE_ROLE_PERMS and group is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"group": "Requerido para modificar permisos."})
        serializer.save(requester=self.request.user)

    def update(self, request, *args, **kwargs):
        solicitud = self.get_object()
        if solicitud.status != SolicitudCambioRol.STATUS_BORRADOR or solicitud.requester_id != request.user.pk:
            return Response(
                {"error": "Solo el solicitante puede editar el borrador."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        solicitud = self.get_object()
        if solicitud.status != SolicitudCambioRol.STATUS_BORRADOR or solicitud.requester_id != request.user.pk:
            return Response(
                {"error": "Solo se puede eliminar un borrador propio (usa cancelar si ya se envió)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """BORRADOR → PENDIENTE: valida,_snapshot, hash, techo y expiración."""
        solicitud = self.get_object()
        if solicitud.status != SolicitudCambioRol.STATUS_BORRADOR or solicitud.requester_id != request.user.pk:
            return Response(
                {"error": "Solo el solicitante puede enviar su borrador."},
                status=status.HTTP_403_FORBIDDEN,
            )
        pending_count = SolicitudCambioRol.objects.filter(
            requester=request.user, status=SolicitudCambioRol.STATUS_PENDIENTE
        ).count()
        if pending_count >= SolicitudCambioRol.MAX_PENDING_PER_USER:
            return Response(
                {"error": f"Límite de {SolicitudCambioRol.MAX_PENDING_PER_USER} solicitudes abiertas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        level, codes = proposed_role_data(solicitud)
        if solicitud.action == SolicitudCambioRol.ACTION_CREATE_ROLE:
            name = (solicitud.payload.get("name") or "").strip()
            if len(name) < 3:
                return Response(
                    {"error": "El rol propuesto necesita nombre (mínimo 3 caracteres)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if level <= 0:
                return Response(
                    {"error": "Nivel inválido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        has_members = solicitud.group.user_groups.exists() if solicitud.group else False
        touches_system = bool(solicitud.group and solicitud.group.is_system)
        sec_level, reasons = classify_role_change(
            request.user, level, codes,
            has_members=has_members, touches_system=touches_system,
        )
        snapshot = sorted(codes)
        solicitud.payload = {**(solicitud.payload or {}), "snapshot": snapshot}
        solicitud.content_hash = canonical_hash(solicitud.action, solicitud.group_id, solicitud.payload)
        solicitud.security_level = sec_level
        solicitud.status = SolicitudCambioRol.STATUS_PENDIENTE
        solicitud.expires_at = timezone.now() + timedelta(days=SolicitudCambioRol.EXPIRY_DAYS)
        solicitud.save()
        notify_on_submit(solicitud, level, codes)
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_PERMISSIONS,
            action=AuditLog.ACTION_CREATE,
            target_id=solicitud.pk,
            target_repr=f"Solicitud #{solicitud.pk} {solicitud.action}",
            detail=f"Nivel {sec_level} ({'; '.join(reasons) if reasons else 'sin alertas'}). Expira {solicitud.expires_at:%Y-%m-%d}.",
            request=request,
        )
        return Response(self.get_serializer(solicitud).data)

    def _decide(self, request, solicitud, approve, final_codes=None, decision_reason=""):
        """Núcleo común de aprobar/rechazar."""
        if refresh_status(solicitud) != SolicitudCambioRol.STATUS_PENDIENTE:
            return Response(
                {"error": f"La solicitud ya no está pendiente ({solicitud.status})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not check_step_up(request.user, request.data.get("password", "")) and not check_step_up_totp(
            request.user, request.data.get("totp_code", "")
        ):
            return Response(
                {"error": "Confirma con tu contraseña o tu código de app (step-up)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        level, codes = proposed_role_data(solicitud)
        eligible, why = approver_eligible(request.user, solicitud, level)
        if not eligible:
            return Response({"error": why}, status=status.HTTP_403_FORBIDDEN)
        # Solicitante vigente: activo (eliminar lo borra por CASCADE).
        requester = solicitud.requester
        if requester is None or not requester.is_active:
            solicitud.status = SolicitudCambioRol.STATUS_CANCELADA
            solicitud.decision_reason = "Solicitante degradado o eliminado."
            solicitud.save(update_fields=["status", "decision_reason", "updated_at"])
            return Response(
                {"error": "El solicitante ya no está vigente: solicitud cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Snapshot: el rol no debió cambiar desde el envío (anti A→A+).
        if sorted(codes) != sorted((solicitud.payload or {}).get("snapshot", [])):
            solicitud.status = SolicitudCambioRol.STATUS_CANCELADA
            solicitud.decision_reason = "El rol cambió después de enviar."
            solicitud.save(update_fields=["status", "decision_reason", "updated_at"])
            return Response(
                {"error": "El rol cambió después de enviar: solicitud invalidada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not approve:
            solicitud.status = SolicitudCambioRol.STATUS_RECHAZADA
            solicitud.approver = request.user
            solicitud.decision_reason = decision_reason or "Sin motivo."
            solicitud.decided_at = timezone.now()
            solicitud.save()
            notify_on_decision(solicitud, False)
            audit_log(
                actor=request.user,
                module=AuditLog.MODULE_PERMISSIONS,
                action=AuditLog.ACTION_UPDATE,
                target_id=solicitud.pk,
                target_repr=f"Solicitud #{solicitud.pk} {solicitud.action}",
                detail=f"Rechazada. Motivo: {solicitud.decision_reason}",
                request=request,
            )
            return Response(self.get_serializer(solicitud).data)

        # Aprobar: recortes solo pueden quitar (subconjunto de lo propuesto).
        if final_codes is not None:
            if not set(final_codes) <= set(codes):
                return Response(
                    {"error": "Los recortes solo pueden quitar permisos, no agregar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            codes = list(final_codes)
        self._apply(solicitud, level, codes)
        solicitud.status = SolicitudCambioRol.STATUS_ACTIVA
        solicitud.approver = request.user
        solicitud.decision_reason = decision_reason or "Aprobada."
        solicitud.decided_at = timezone.now()
        solicitud.save()
        notify_on_decision(solicitud, True)
        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_PERMISSIONS,
            action=AuditLog.ACTION_UPDATE,
            target_id=solicitud.pk,
            target_repr=f"Solicitud #{solicitud.pk} {solicitud.action}",
            detail=f"Aprobada y aplicada ({len(codes)} permisos). {decision_reason}".strip(),
            request=request,
        )
        return Response(self.get_serializer(solicitud).data)

    @staticmethod
    def _apply(solicitud, level, codes):
        """Aplica la elevación aprobada."""
        with transaction.atomic():
            if solicitud.action == SolicitudCambioRol.ACTION_CREATE_ROLE:
                payload = solicitud.payload or {}
                name = unicodedata.normalize("NFKC", payload.get("name") or "").strip()
                if Group.objects.filter(name__iexact=name).exists():
                    from rest_framework.exceptions import ValidationError

                    raise ValidationError("Ya existe un grupo con ese nombre.")
                template = Group.objects.filter(pk=payload.get("template_id")).first()
                group = Group.objects.create(
                    name=name,
                    description=payload.get("description", ""),
                    level=level,
                    template_role=template,
                )
                solicitud.group = group
                solicitud.save(update_fields=["group"])
            else:
                group = Group.objects.select_for_update().get(pk=solicitud.group_id)
            wanted = set(codes)
            current = set(group.permissions.values_list("codename", flat=True))
            to_add = Permission.objects.filter(codename__in=(wanted - current))
            to_remove = group.permissions.filter(codename__in=(current - wanted))
            if to_add:
                GroupPermission.objects.bulk_create(
                    [GroupPermission(group=group, permission=p) for p in to_add],
                    ignore_conflicts=True,
                )
            if to_remove:
                GroupPermission.objects.filter(group=group, permission__in=to_remove).delete()
            for user_group in group.user_groups.all():
                PermissionService.invalidate_user_cache(user_group.user.id)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        solicitud = self.get_object()
        return self._decide(
            request, solicitud, True,
            final_codes=request.data.get("perm_codenames"),
            decision_reason=request.data.get("decision_reason", ""),
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        solicitud = self.get_object()
        return self._decide(
            request, solicitud, False,
            decision_reason=request.data.get("decision_reason", ""),
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.status not in (
            SolicitudCambioRol.STATUS_BORRADOR, SolicitudCambioRol.STATUS_PENDIENTE
        ) or (solicitud.requester_id != request.user.pk and not is_top(request.user)):
            return Response(
                {"error": "No puedes cancelar esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )
        solicitud.status = SolicitudCambioRol.STATUS_CANCELADA
        solicitud.decision_reason = "Cancelada por el solicitante."
        solicitud.save(update_fields=["status", "decision_reason", "updated_at"])
        return Response(self.get_serializer(solicitud).data)
