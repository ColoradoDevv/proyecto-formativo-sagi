# Migración 0012 — Otorga codenames exigidos por las vistas que ningún
# grupo tenía (solo un superusuario real de Django pasaba):
#   - edit_loan    (LoanViewSet update/partial_update)
#   - delete_task  (TaskViewSet destroy)
#   - view_brand / edit_brand (BrandViewSet list/create/update)
# Además completa los catálogos de solo lectura para los grupos que
# operan materiales pero no podían listarlos en los selects:
#   - view_inventory / view_category → INST e INV
#     (create/edit siguen siendo solo ADMIN/SADMIN según 0009/0010).
#
# Se usa .add() (no .set()) para no pisar permisos personalizados desde
# la pantalla de Roles y Permisos. SADMIN se incluye explícito porque su
# .set() de 0002 fue una foto fija y no hereda permisos creados después.

from django.db import migrations


# codename -> grupos que deben tenerlo.
GRANTS = {
    "edit_loan":      ["SADMIN", "ADMIN", "INST"],
    "delete_task":    ["SADMIN", "ADMIN"],
    "view_brand":     ["SADMIN", "ADMIN", "INST", "INV"],
    "edit_brand":     ["SADMIN", "ADMIN"],
    "view_inventory": ["SADMIN", "ADMIN", "INST", "INV"],
    "view_category":  ["SADMIN", "ADMIN", "INST", "INV"],
}


def apply_migration(apps, schema_editor):
    Permission = apps.get_model("permissions", "Permission")
    Group = apps.get_model("permissions", "Group")

    for codename, group_names in GRANTS.items():
        permission = Permission.objects.filter(codename=codename).first()
        if not permission:
            continue
        for group in Group.objects.filter(name__in=group_names):
            group.permissions.add(permission)


def reverse_migration(apps, schema_editor):
    Permission = apps.get_model("permissions", "Permission")
    Group = apps.get_model("permissions", "Group")

    for codename, group_names in GRANTS.items():
        permission = Permission.objects.filter(codename=codename).first()
        if not permission:
            continue
        for group in Group.objects.filter(name__in=group_names):
            group.permissions.remove(permission)


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0011_add_quotation_permissions"),
    ]

    operations = [
        migrations.RunPython(
            apply_migration,
            reverse_code=reverse_migration,
        ),
    ]
