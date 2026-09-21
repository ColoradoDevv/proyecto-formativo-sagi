# Migracion 0008 — Agrega los codenames de permiso requeridos por
# TaskAssignmentViewSet y los asigna a los grupos ADMIN/SADMIN.
#
# Codenames nuevos:
#   - view_task_assignment        (GET list/retrieve de asignaciones)
#   - create_task_assignment      (POST: asignar una tarea a un usuario)
#   - edit_task_assignment        (PUT/PATCH: cambiar estado y fechas de una asignacion
#                                  concreta — solo admin/supervisor)
#   - delete_task_assignment      (DELETE: quitar una asignacion)
#
# Regla de negocio confirmada con el equipo:
#   * Solo usuarios con rol admin/supervisor y el permiso explicito pueden
#     cambiar el estado de tareas propias o de otros usuarios.
#   * Como en este proyecto los grupos se llaman ADMIN/SADMIN (no existe un
#     grupo SUPERVISOR separado), otorgamos los cuatro permisos a ambos.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "view_task_assignment",
        "Ver asignaciones de tarea",
        "Ver el listado y detalle de asignaciones de tareas a usuarios",
    ),
    (
        "create_task_assignment",
        "Asignar tarea a usuario",
        "Registrar una nueva asignacion de tarea a un usuario concreto",
    ),
    (
        "edit_task_assignment",
        "Editar asignacion de tarea",
        "Modificar el estado, fechas o datos de una asignacion de tarea existente",
    ),
    (
        "delete_task_assignment",
        "Eliminar asignacion de tarea",
        "Eliminar una asignacion de tarea (quita la tarea al usuario)",
    ),
]

# codename -> grupos que deben tenerlo.
GRANTS = {
    "view_task_assignment":   ["ADMIN", "SADMIN"],
    "create_task_assignment": ["ADMIN", "SADMIN"],
    "edit_task_assignment":   ["ADMIN", "SADMIN"],
    "delete_task_assignment": ["ADMIN", "SADMIN"],
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
        ("permissions", "0007_grant_missing_product_permissions"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
