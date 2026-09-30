#
# Reglas duras de jerarquía (Fase 4 del sistema dinámico de roles, diseño v3).
#
# Solo VISIBILIDAD en Fase 3; aquí van las ACCIONES:
# - Roles: solo niveles estrictamente inferiores (nunca pares).
# - Usuarios: mismo nivel o inferiores.
# - Solo el Primigenio está exento (is_superuser NO exime en acciones).
# - N2/N3 sin workflow de aprobación (Fase 5) se rechazan salvo Primigenio,
#   que actúa directo y auditado (transitorio, documentado).
#

from modules.permissions.authority import CRITICAL_PERMISSIONS, permission_weight_for
from modules.permissions.services import PermissionService
from django.db.models import Min


# Permisos con objeto (alcance SELF/ALL) — Fase 6. Préstamos (responsable o
# receptor) y asignaciones de tareas (asignado directo o por grupo). El resto
# de permisos son globales y el scope se ignora (= todo).
SCOPED_PERMISSIONS = frozenset({
    "view_loan",
    "list_loans",
    "edit_loan",
    "delete_loan",
    "return_material",
    "register_surplus",
    "validate_loan_return",
    "view_task_assignment",
    "edit_task_assignment",
    "delete_task_assignment",
})


def effective_scope(user, codename):
    """Alcance efectivo: ALL si alguna asignación lo otorga; si no, SELF.

    Primigenio/superusuario → ALL. Permisos sin objeto → ALL siempre.
    Se llama solo cuando has_permission ya es True.
    """
    if codename not in SCOPED_PERMISSIONS:
        return "ALL"
    if not user or not user.is_authenticated:
        return "SELF"
    if getattr(user, "is_primary_admin", False) or getattr(user, "is_superuser", False):
        return "ALL"
    from modules.permissions.models import UserGroup, UserPermission

    scopes = set(
        UserPermission.objects.filter(
            user=user, permission__codename=codename
        ).values_list("scope", flat=True)
    )
    scopes.update(
        UserGroup.objects.filter(
            user=user, group__group_permissions__permission__codename=codename
        ).values_list("group__group_permissions__scope", flat=True)
    )
    return "ALL" if "ALL" in scopes else "SELF"


def normalize_scope(codename, scope):
    """Normaliza el alcance a guardar: permisos sin objeto siempre ALL;
    el resto respeta lo pedido (SELF por defecto)."""
    if codename not in SCOPED_PERMISSIONS:
        return "ALL"
    return "ALL" if scope == "ALL" else "SELF"


def action_level(user):
    """Nivel para ACCIONES. Solo el Primigenio está exento (None = cima).

    A diferencia de effective_level (listados), is_superuser NO exime:
    un superusuario no primigenio actúa con el nivel de sus grupos.
    """
    if not user or not user.is_authenticated:
        return PermissionService.BOTTOM_LEVEL
    if getattr(user, "is_primary_admin", False):
        return None
    levels = list(
        user.user_groups.values_list("group__level", flat=True)
    )
    return min(levels) if levels else PermissionService.BOTTOM_LEVEL


def is_top(user):
    """True si el usuario está exento de las reglas de rango (Primigenio)."""
    return action_level(user) is None


def target_user_level(target):
    """Nivel efectivo del usuario objetivo (mínimo de sus grupos, 900 si no tiene)."""
    if getattr(target, "is_primary_admin", False):
        return None
    levels = list(
        target.user_groups.values_list("group__level", flat=True)
    )
    return min(levels) if levels else PermissionService.BOTTOM_LEVEL


def can_manage_user(actor, target):
    """Acciones sobre usuarios: mismo nivel o inferiores. El Primigenio todo."""
    if is_top(actor):
        return True
    target_level = target_user_level(target)
    if target_level is None:
        return False
    return target_level >= action_level(actor)


def can_manage_group(actor, group):
    """Acciones sobre roles: niveles estrictamente inferiores. El Primigenio todo."""
    if is_top(actor):
        return True
    return group.level > action_level(actor)


def can_grant_permission(actor, codename):
    """No amplificación: solo das permisos que posees (usar ≠ delegar)."""
    return PermissionService.has_permission(actor, codename)


def role_authority(perm_codenames):
    """Autoridad estimada de un conjunto de permisos (suma de pesos)."""
    return sum(permission_weight_for(code) for code in perm_codenames)


def creator_authority(creator):
    """Autoridad del creador. Primigenio/superusuario = infinito."""
    if not creator or not creator.is_authenticated:
        return 0
    if getattr(creator, "is_primary_admin", False) or getattr(creator, "is_superuser", False):
        return float("inf")
    codes = PermissionService.get_user_permission_codes(creator)
    return role_authority(codes)


def classify_role_change(creator, level, perm_codenames, has_members=False, touches_system=False):
    """Clasifica N1/N2/N3 una creación o modificación de rol.

    Retorna (nivel, [motivos]). Solo lectura: la ejecución la deciden las vistas.
    - N3: supera al creador, permisos críticos, tocar roles de sistema.
    - N2: sensibles, excede techo del nivel, rol con usuarios.
    - N1: resto.
    """
    from modules.permissions.models import Group

    reasons = []
    weights = [permission_weight_for(code) for code in perm_codenames]
    authority = sum(weights)

    if touches_system:
        reasons.append("toca un rol de sistema")
        return "N3", reasons
    if any(code in CRITICAL_PERMISSIONS for code in perm_codenames):
        reasons.append("incluye permisos críticos")
        return "N3", reasons
    if authority > creator_authority(creator):
        reasons.append("supera la autoridad del creador")
        return "N3", reasons

    ceiling = (
        Group.objects.filter(level=level).aggregate(ceiling=Min("authority_ceiling"))["ceiling"]
    )
    if ceiling is not None and authority > ceiling:
        reasons.append(f"excede el techo del nivel ({authority} > {ceiling})")
    if any(w >= 50 for w in weights):
        reasons.append("incluye permisos sensibles")
    if has_members:
        reasons.append("modifica un rol que ya tiene usuarios")
    if reasons:
        return "N2", reasons
    return "N1", reasons
