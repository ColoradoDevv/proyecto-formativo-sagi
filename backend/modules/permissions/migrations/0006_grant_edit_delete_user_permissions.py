# Migración 0006 — Otorga a SADMIN y ADMIN los codenames edit_user/delete_user
# que la migración 0004 creó pero nunca asignó a ningún grupo.
#
# UserDetailView (backend/modules/users/views.py) exige edit_user para
# PUT/PATCH y delete_user para DELETE desde que se agregaron esos codenames,
# pero 0004 solo los insertó en la tabla Permission (get_or_create) sin
# tocar ningún Group.permissions — así que hasta esta migración, solo un
# superusuario real de Django podía editar, eliminar o activar/desactivar
# un usuario desde la app.
#
# Usamos .add() (no .set()) para no pisar permisos que ya se hayan
# personalizado manualmente desde la pantalla de Roles y Permisos.

from django.db import migrations


TARGET_GROUPS = ["SADMIN", "ADMIN"]
NEW_CODENAMES = ["edit_user", "delete_user"]


def grant_permissions(apps, schema_editor):
    Group = apps.get_model("permissions", "Group")
    Permission = apps.get_model("permissions", "Permission")

    permissions = Permission.objects.filter(codename__in=NEW_CODENAMES)
    for group in Group.objects.filter(name__in=TARGET_GROUPS):
        group.permissions.add(*permissions)


def revoke_permissions(apps, schema_editor):
    Group = apps.get_model("permissions", "Group")
    Permission = apps.get_model("permissions", "Permission")

    permissions = Permission.objects.filter(codename__in=NEW_CODENAMES)
    for group in Group.objects.filter(name__in=TARGET_GROUPS):
        group.permissions.remove(*permissions)


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0005_add_is_active_to_group"),
    ]

    operations = [
        migrations.RunPython(
            grant_permissions,
            reverse_code=revoke_permissions,
        ),
    ]
