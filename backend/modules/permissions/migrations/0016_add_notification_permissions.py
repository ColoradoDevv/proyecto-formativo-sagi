# Migracion 0016 — Crea los permisos de la campana de notificaciones, que
# antes se decidia por nombres de grupo hardcodeados en el frontend
# (SADMIN/ADMIN/INST -> prestamos, resto -> tareas):
#   - view_loan_notifications  (panel "Ultimos prestamos")
#   - view_task_notifications  (panel "Mis tareas asignadas")
#
# Son mutuamente excluyentes: un grupo o usuario solo puede tener uno de
# los dos (lo validan el backend y la UI). Los grants replican el
# comportamiento anterior: SADMIN/ADMIN/INST veian prestamos, INV tareas.
# Los superusuarios reales ven ambas pestanas por bypass de is_superuser.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "view_loan_notifications",
        "Ver prestamos en notificaciones",
        "Mostrar el panel de ultimos prestamos en la campana de notificaciones",
    ),
    (
        "view_task_notifications",
        "Ver tareas en notificaciones",
        "Mostrar el panel de tareas asignadas en la campana de notificaciones",
    ),
]

GRANTS = {
    "view_loan_notifications": ["SADMIN", "ADMIN", "INST"],
    "view_task_notifications": ["INV"],
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
        ("permissions", "0015_add_edit_task_permission"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
