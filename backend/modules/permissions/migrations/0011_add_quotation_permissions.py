# Migracion 0011 — Crea los codenames de permiso del modulo QuotationViewSet
# (biblioteca de cotizaciones) y los asigna a ADMIN/SADMIN.
#
# Codenames nuevos:
#   - view_quotation    (GET list/retrieve)
#   - create_quotation  (POST)
#   - edit_quotation    (PATCH)
#   - delete_quotation  (DELETE)
#
# Mismo patron que category/inventory: todo a ADMIN y SADMIN.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "view_quotation",
        "Ver cotizaciones",
        "Ver el listado y detalle de cotizaciones",
    ),
    (
        "create_quotation",
        "Subir cotización",
        "Subir un PDF de cotización a la biblioteca",
    ),
    (
        "edit_quotation",
        "Editar cotización",
        "Renombrar o asignar/liberar una cotización",
    ),
    (
        "delete_quotation",
        "Eliminar cotización",
        "Eliminar una cotización (DELETE)",
    ),
]

GRANTS = {
    "view_quotation":   ["ADMIN", "SADMIN"],
    "create_quotation": ["ADMIN", "SADMIN"],
    "edit_quotation":   ["ADMIN", "SADMIN"],
    "delete_quotation": ["ADMIN", "SADMIN"],
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
        ("permissions", "0010_add_category_permissions"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
