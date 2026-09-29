# Migracion 0009 — Crea los codenames de permiso del modulo InventoryViewSet
# (CRUD de "Nombre de inventario") y los asigna a ADMIN/SADMIN.
#
# Codenames nuevos:
#   - view_inventory         (GET list/retrieve)
#   - create_inventory       (POST)
#   - edit_inventory         (PUT/PATCH)
#   - delete_inventory       (DELETE)
#
# Mismo patron que brand (0004): list/retrieve/create/update se otorgan a
# ADMIN y SADMIN. delete queda restringido a superusuarios (la vista exige
# IsSuperUser en destroy).

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "view_inventory",
        "Ver nombres de inventario",
        "Ver el listado y detalle de nombres de inventario",
    ),
    (
        "create_inventory",
        "Crear nombre de inventario",
        "Registrar un nuevo nombre de inventario",
    ),
    (
        "edit_inventory",
        "Editar nombre de inventario",
        "Modificar un nombre de inventario existente",
    ),
    (
        "delete_inventory",
        "Eliminar nombre de inventario",
        "Eliminar un nombre de inventario (DELETE)",
    ),
]

# codename -> grupos que deben tenerlo.
GRANTS = {
    "view_inventory":   ["ADMIN", "SADMIN"],
    "create_inventory": ["ADMIN", "SADMIN"],
    "edit_inventory":   ["ADMIN", "SADMIN"],
    "delete_inventory": ["ADMIN", "SADMIN"],
}


def create_and_grant(apps, schema_editor):
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


def reverse(apps, schema_editor):
    Permission = apps.get_model("permissions", "Permission")
    Group = apps.get_model("permissions", "Group")

    for codename, group_names in GRANTS.items():
        permission = Permission.objects.filter(codename=codename).first()
        if not permission:
            continue
        for group in Group.objects.filter(name__in=group_names):
            group.permissions.remove(permission)

    codenames = [c for c, _, _ in NEW_PERMISSIONS]
    Permission.objects.filter(codename__in=codenames).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0008_add_task_assignment_permissions"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
