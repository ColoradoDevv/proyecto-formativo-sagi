#
# Métrica de autoridad para el sistema dinámico de roles (Fase 1).
#
# El peso mide CUÁNTO poder administrativo representa un permiso.
# Es solo una métrica de análisis y alertas: nunca decide jerarquía
# (ver docs del diseño v3). La jerarquía la define Group.level (Fase 2).
#

# Permisos críticos: gestionar roles/permisos y exportar auditoría.
CRITICAL_PERMISSIONS = frozenset({
    "create_role",
    "update_role",
    "disable_role",
    "manage_role_permissions",
    "export_audit",
    "approve_elevation",
})


def permission_weight_for(codename):
    """Peso por defecto de un permiso según su tier.

    - Crítico (roles/permisos/auditoría) → 150
    - delete_* → 100
    - disable_* → 50
    - create_*/update_*/change_*/approve_*/assign_*/return_*/register_*/validate_* → 30
    - export_* → 20
    - view_*/list_* y resto → 10
    """
    code = (codename or "").strip().lower()
    if code in CRITICAL_PERMISSIONS:
        return 150
    if code.startswith("delete_"):
        return 100
    if code.startswith("disable_"):
        return 50
    if code.startswith(
        ("create_", "update_", "change_", "approve_", "assign_", "return_", "register_", "validate_")
    ):
        return 30
    if code.startswith("export_"):
        return 20
    return 10
