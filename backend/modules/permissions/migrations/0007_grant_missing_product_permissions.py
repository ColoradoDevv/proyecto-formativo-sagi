# Migración 0007 — Cierra el mismo hueco que 0006 cerró para usuarios, pero
# para materiales de consumo, materiales devolutivos y devoluciones de
# préstamos.
#
# ConsumableMaterialViewSet.get_permissions() / ReturnableMaterialViewSet.
# get_permissions() / LoanReturnViewSet.get_permissions() exigen los
# codenames "nuevos" (view_consumable, edit_consumable, view_returnable,
# edit_returnable, create_return) desde que existen, pero:
#   - view_consumable, edit_consumable, view_returnable, edit_returnable y
#     create_return los creó 0004_add_missing_viewset_permissions.py sin
#     asignárselos a ningún grupo.
#   - create_consumable y create_returnable ni siquiera existen como fila
#     de Permission — no hay ningún migration que los haya creado.
#
# Resultado confirmado en BD: hoy solo un superusuario real de Django puede
# listar, crear, editar o ver un material de consumo o devolutivo, o
# registrar una devolución de préstamo.
#
# Otorgamos a los mismos grupos que ya tienen el codename viejo equivalente
# (create_consumable_material/view_consumable_material/update_consumable_material,
# su par para devolutivos, y return_material/register_surplus para
# create_return) — confirmado en BD antes de escribir esta migración.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "create_consumable",
        "Crear material de consumo",
        "Registrar un nuevo material de consumo",
    ),
    (
        "create_returnable",
        "Crear material devolutivo",
        "Registrar un nuevo material devolutivo",
    ),
]

# codename -> nombres de los grupos que deben tenerlo
GRANTS = {
    "create_consumable": ["ADMIN", "INST", "SADMIN"],
    "view_consumable":   ["ADMIN", "INST", "INV", "SADMIN"],
    "edit_consumable":   ["ADMIN", "INST", "SADMIN"],
    "create_returnable": ["ADMIN", "INST", "SADMIN"],
    "view_returnable":   ["ADMIN", "INST", "INV", "SADMIN"],
    "edit_returnable":   ["ADMIN", "INST", "SADMIN"],
    "create_return":     ["ADMIN", "INST", "INV", "SADMIN"],
}


def apply_migration(apps, schema_editor):
    Permission = apps.get_model("permissions", "Permission")
    Group = apps.get_model("permissions", "Group")

    for codename, name, description in NEW_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=codename,
            defaults={"name": name, "description": description},
        )

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

    codenames = [codename for codename, _, _ in NEW_PERMISSIONS]
    Permission.objects.filter(codename__in=codenames).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0006_grant_edit_delete_user_permissions"),
    ]

    operations = [
        migrations.RunPython(
            apply_migration,
            reverse_code=reverse_migration,
        ),
    ]
