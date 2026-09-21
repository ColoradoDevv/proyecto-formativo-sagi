# Migracion 0010 — Crea los codenames de permiso del modulo CategoryViewSet
# (CRUD de "Categorias" compartidas por consumibles y devolutivos) y los
# asigna a ADMIN/SADMIN.
#
# Codenames nuevos:
#   - view_category         (GET list/retrieve)
#   - create_category       (POST)
#   - edit_category         (PUT/PATCH)
#   - delete_category       (DELETE)
#
# Mismo patron que brand/inventory: list/retrieve/create/update se otorgan
# a ADMIN y SADMIN; delete queda restringido a superusuarios.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "view_category",
        "Ver categorías",
        "Ver el listado y detalle de categorías",
    ),
    (
        "create_category",
        "Crear categoría",
        "Registrar una nueva categoría",
    ),
    (
        "edit_category",
        "Editar categoría",
        "Modificar una categoría existente",
    ),
    (
        "delete_category",
        "Eliminar categoría",
        "Eliminar una categoría (DELETE)",
    ),
]

GRANTS = {
    "view_category":   ["ADMIN", "SADMIN"],
    "create_category": ["ADMIN", "SADMIN"],
    "edit_category":   ["ADMIN", "SADMIN"],
    "delete_category": ["ADMIN", "SADMIN"],
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
        ("permissions", "0009_add_inventory_permissions"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
