#
# Helpers de auditoría reutilizables en cualquier vista o signal.
#

from .models import AuditLog


def get_client_ip(request) -> str | None:
    """Extrae la IP real del cliente, considerando proxies."""
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_actor_name(user) -> str:
    """Devuelve el nombre completo del usuario o 'Sistema'."""
    if user is None or not getattr(user, "pk", None):
        return "Sistema"
    return f"{user.first_name} {user.last_name}".strip() or user.email


def log(
    *,
    actor=None,
    module: str,
    action: str,
    target_id=None,
    target_repr: str = "",
    detail: str = "",
    request=None,
    ip_address: str | None = None,
) -> AuditLog:
    """
    Registra una entrada de auditoría.

    Uso:
        from modules.audit.utils import log as audit_log
        from modules.audit.models import AuditLog

        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_USERS,
            action=AuditLog.ACTION_CREATE,
            target_id=user.pk,
            target_repr=str(user),
            detail=f"Email: {user.email}",
            request=request,
        )
    """
    ip = ip_address or get_client_ip(request)
    name = get_actor_name(actor)

    # El superadmin no deja rastro en la auditoría.
    if actor and getattr(actor, "is_superuser", False):
        return None

    return AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "pk", None)) else None,
        actor_name=name,
        module=module,
        action=action,
        target_id=target_id,
        target_repr=target_repr[:200] if target_repr else "",
        detail=detail,
        ip_address=ip,
    )
