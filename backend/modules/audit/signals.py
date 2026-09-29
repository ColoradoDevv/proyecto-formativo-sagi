#
# Señales de auditoría.
#
# En lugar de modificar cada vista existente, usamos el patrón request-local
# para pasar el request a través de los signals de Django:
#
#   - audit_request_started  → la vista llama a set_current_request(request)
#     antes de la operación (via mixin AuditMixin).
#   - Las señales post_save / post_delete leen el request con
#     get_current_request() y crean la entrada de log.
#
# Para acciones que no encajan en signals de modelo (login, logout,
# cambio de contraseña, firma, toggle_active, etc.) las vistas existentes
# llaman directamente a audit.utils.log().
#

import threading

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver, Signal

from modules.audit.models import AuditLog
from modules.audit.utils import log, get_client_ip, get_actor_name

# ── Thread-local para transportar el request hasta los signal handlers ────────
_request_local = threading.local()


def set_current_request(request):
    """Guarda el request en el contexto del hilo actual."""
    _request_local.request = request


def clear_current_request():
    """Limpia el request al terminar la petición."""
    _request_local.request = None


def get_current_request():
    """Devuelve el request del hilo actual o None."""
    return getattr(_request_local, "request", None)


# ── Señal personalizada: toggle_active ───────────────────────────────────────
# Se dispara desde las vistas de toggle_active de productos y grupos,
# ya que ese evento no genera un post_save genérico limpio (es una acción
# semántica diferente al UPDATE normal).
audit_toggle_active = Signal()


@receiver(audit_toggle_active)
def handle_toggle_active(sender, instance, is_active, request=None, module=None, **kwargs):
    req = request or get_current_request()
    actor = getattr(req, "user", None) if req else None
    detail = "Activado" if is_active else "Desactivado"
    log(
        actor=actor,
        module=module or AuditLog.MODULE_CONSUMABLES,
        action=AuditLog.ACTION_TOGGLE_ACTIVE,
        target_id=getattr(instance, "pk", None),
        target_repr=str(instance),
        detail=detail,
        request=req,
    )


# ── Usuarios ──────────────────────────────────────────────────────────────────

from modules.users.models import User  # noqa: E402 — import late para evitar circular


@receiver(post_save, sender=User)
def handle_user_save(sender, instance, created, **kwargs):
    req = get_current_request()
    actor = getattr(req, "user", None) if req else None

    # Ignorar saves propios del sistema de auth (last_login, etc.)
    # cuando no hay request en curso.
    if req is None:
        return

    if created:
        log(
            actor=actor,
            module=AuditLog.MODULE_USERS,
            action=AuditLog.ACTION_CREATE,
            target_id=instance.pk,
            target_repr=f"{instance.first_name} {instance.last_name} <{instance.email}>",
            detail=f"Documento: {instance.document_number or '—'}",
            request=req,
        )
    else:
        # Detectar si es un cambio de estado (activar/desactivar)
        # El campo update_fields viene del save() que hace soft_delete() / restore()
        update_fields = kwargs.get("update_fields") or set()
        if "is_deleted" in update_fields:
            action = AuditLog.ACTION_DELETE
            detail = f"Eliminado lógicamente: {instance.email}"
        elif "is_active" in update_fields and "is_deleted" not in update_fields:
            action = AuditLog.ACTION_TOGGLE_ACTIVE
            detail = f"{'Activado' if instance.is_active else 'Desactivado'}: {instance.email}"
        else:
            action = AuditLog.ACTION_UPDATE
            detail = f"Datos actualizados: {instance.email}"

        log(
            actor=actor,
            module=AuditLog.MODULE_USERS,
            action=action,
            target_id=instance.pk,
            target_repr=f"{instance.first_name} {instance.last_name} <{instance.email}>",
            detail=detail,
            request=req,
        )


# ── Productos: ConsumableMaterial ─────────────────────────────────────────────

from modules.products.models import ConsumableMaterial, ReturnableMaterial  # noqa: E402


@receiver(post_save, sender=ConsumableMaterial)
def handle_consumable_save(sender, instance, created, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)

    # Las acciones toggle_active llaman directamente a audit_toggle_active;
    # aquí solo manejamos CREATE y UPDATE normales.
    update_fields = set(kwargs.get("update_fields") or [])
    if update_fields == {"is_active", "state"}:
        # Viene de toggle_active — ya se audita vía audit_toggle_active signal.
        return

    # Devolutivos crean su consumable base dentro de ReturnableMaterialViewSet.create;
    # la señal de ReturnableMaterial.post_save la audita con el módulo correcto.
    # Aquí solo auditamos consumables puros.
    is_returnable = ReturnableMaterial.objects.filter(pk=instance.pk).exists()
    if is_returnable:
        return

    log(
        actor=actor,
        module=AuditLog.MODULE_CONSUMABLES,
        action=AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE,
        target_id=instance.pk,
        target_repr=instance.name,
        detail=f"Estado: {instance.state} | Cantidad: {instance.quantity}",
        request=req,
    )


@receiver(post_delete, sender=ConsumableMaterial)
def handle_consumable_delete(sender, instance, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    log(
        actor=actor,
        module=AuditLog.MODULE_CONSUMABLES,
        action=AuditLog.ACTION_DELETE,
        target_id=instance.pk,
        target_repr=instance.name,
        request=req,
    )


@receiver(post_save, sender=ReturnableMaterial)
def handle_returnable_save(sender, instance, created, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)

    update_fields = set(kwargs.get("update_fields") or [])
    if update_fields == {"is_active", "state"}:
        return  # auditado por audit_toggle_active

    log(
        actor=actor,
        module=AuditLog.MODULE_RETURNABLES,
        action=AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE,
        target_id=instance.pk,
        target_repr=instance.consumable.name,
        detail=f"Serial: {instance.serial} | Modelo: {instance.model}",
        request=req,
    )


@receiver(post_delete, sender=ReturnableMaterial)
def handle_returnable_delete(sender, instance, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    log(
        actor=actor,
        module=AuditLog.MODULE_RETURNABLES,
        action=AuditLog.ACTION_DELETE,
        target_id=instance.pk,
        target_repr=instance.consumable.name,
        request=req,
    )


# ── Productos: Brand ──────────────────────────────────────────────────────────

from modules.products.models import Brand  # noqa: E402


@receiver(post_save, sender=Brand)
def handle_brand_save(sender, instance, created, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    log(
        actor=actor,
        module=AuditLog.MODULE_BRANDS,
        action=AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE,
        target_id=instance.pk,
        target_repr=instance.name,
        request=req,
    )


@receiver(post_delete, sender=Brand)
def handle_brand_delete(sender, instance, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    log(
        actor=actor,
        module=AuditLog.MODULE_BRANDS,
        action=AuditLog.ACTION_DELETE,
        target_id=instance.pk,
        target_repr=instance.name,
        request=req,
    )


# ── Préstamos ─────────────────────────────────────────────────────────────────

from modules.loans.models import Loans  # noqa: E402


@receiver(post_save, sender=Loans)
def handle_loan_save(sender, instance, created, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    repr_str = (
        f"Préstamo #{instance.pk} — "
        f"{instance.id_material} — "
        f"Receptor: {instance.id_receptor_user}"
    )
    log(
        actor=actor,
        module=AuditLog.MODULE_LOANS,
        action=AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE,
        target_id=instance.pk,
        target_repr=repr_str,
        detail=f"Estado: {instance.state} | Cantidad: {instance.amount_lent}",
        request=req,
    )


@receiver(post_delete, sender=Loans)
def handle_loan_delete(sender, instance, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    log(
        actor=actor,
        module=AuditLog.MODULE_LOANS,
        action=AuditLog.ACTION_DELETE,
        target_id=instance.pk,
        target_repr=f"Préstamo #{instance.pk} — {instance.id_material}",
        request=req,
    )


# ── Devoluciones ──────────────────────────────────────────────────────────────

from modules.returns.models import LoanReturn  # noqa: E402


@receiver(post_save, sender=LoanReturn)
def handle_return_save(sender, instance, created, **kwargs):
    req = get_current_request()
    if req is None:
        return
    actor = getattr(req, "user", None)
    if not created:
        return  # las devoluciones solo se crean, nunca se editan
    log(
        actor=actor,
        module=AuditLog.MODULE_RETURNS,
        action=AuditLog.ACTION_CREATE,
        target_id=instance.pk,
        target_repr=f"Devolución #{instance.pk} — Préstamo #{instance.loan_id}",
        detail=(
            f"Material: {instance.material} | "
            f"Condición: {instance.material_condition} | "
            f"Devuelto: {instance.returned_quantity}"
        ),
        request=req,
    )


# ── Permisos y grupos ─────────────────────────────────────────────────────────
# Los cambios de grupo/permiso los audita directamente la vista
# (UserGroupView, UserPermissionView) porque son operaciones sin señal clara
# en el ORM (M2M add/remove + UserGroup.objects.create/delete).
# Se llama a audit.utils.log() directamente desde permissions/views.py.
