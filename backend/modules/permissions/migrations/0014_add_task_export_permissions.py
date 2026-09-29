# Migracion 0014 — Crea los codenames de exportación de tareas, que los
# botones "Descargar Reporte" exigen en la interfaz:
#   - export_tasks             (reporte de definiciones de tarea)
#   - export_task_assignments  (reporte de asignaciones)
# Los reportes se generan en el cliente con datos ya visibles, así que
# estos códigos son puerta de UI; se otorgan a quienes administran tareas.

from django.db import migrations


NEW_PERMISSIONS = [
    (
        "export_tasks",
        "Exportar tareas",
        "Generar reportes de definiciones de tareas",
    ),
    (
        "export_task_assignments",
        "Exportar asignaciones",
        "Generar reportes de asignaciones de tareas",
    ),
]

GRANTS = {
    "export_tasks":            ["SADMIN", "ADMIN"],
    "export_task_assignments": ["SADMIN", "ADMIN"],
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
        ("permissions", "0013_grant_view_quotation_inst"),
    ]

    operations = [
        migrations.RunPython(
            create_and_grant,
            reverse_code=reverse,
        ),
    ]
