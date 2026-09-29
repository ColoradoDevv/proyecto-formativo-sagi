# Migración 0013 — Otorga view_quotation al grupo INST.
#
# Los formularios de crear/editar materiales (consumibles y devolutivos)
# exigen elegir 1-3 cotizaciones de la biblioteca (QuotationPicker), cuyo
# endpoint de listado requiere view_quotation. Sin este permiso, INST —
# que sí tiene create/edit de materiales — recibe 403 en el picker y no
# puede completar ningún formulario de material.
# Solo lectura: subir/editar/eliminar cotizaciones sigue siendo ADMIN/SADMIN.

from django.db import migrations


GRANTS = {
    "view_quotation": ["INST"],
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
        ("permissions", "0012_grant_missing_enforced_permissions"),
    ]

    operations = [
        migrations.RunPython(
            apply_migration,
            reverse_code=reverse_migration,
        ),
    ]
