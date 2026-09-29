# Migracion 0015 — Crea el codename edit_task, exigido por
# TaskDefinitionViewSet (update/partial_update) pero nunca creado en
# ninguna migracion anterior:
#   - 0002 creo create_task/view_task/update_task/list_tasks
#   - 0004 agrego delete_task, pero no edit_task
# Sin esta fila, PermissionService.has_permission(user, "edit_task") siempre
# es False para no-superusuarios y ADMIN no puede editar tareas aunque la UI
# (MODULE_PERMS.tasks.edit, TaskListPage) lo pida.
# Se otorga a SADMIN y ADMIN, igual que create_task/delete_task.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "edit_task",
        "Editar tarea",
        "Modificar datos de una tarea existente",
    ),
]

GRANTS = {
    "edit_task": ["SADMIN", "ADMIN"],
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
        ("permissions", "0014_add_task_export_permissions"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
