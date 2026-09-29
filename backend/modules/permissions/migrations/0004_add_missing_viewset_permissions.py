#
# Migración 0004 — Agrega los codenames de permiso requeridos por los ViewSets
# que no estaban cubiertos por la migración 0002.
#
# Nuevos codenames:
#   - view_brand, edit_brand              (BrandViewSet)
#   - edit_user, delete_user              (UserDetailView)
#   - view_returnable, edit_returnable    (ReturnableMaterialViewSet)
#   - view_consumable, edit_consumable    (ConsumableMaterialViewSet)
#   - view_loan, edit_loan               (LoanViewSet)
#   - create_return                       (LoanReturnViewSet)
#   - delete_task                         (TaskViewSet)
#
# Los codenames ya cubiertos por 0002 (create_user, view_user, create_brand,
# create_returnable_material, create_consumable_material, create_loan,
# create_task, view_task, update_task) no se reinsertan.
#

from django.db import migrations


MISSING_PERMISSIONS = [
    # BrandViewSet — lectura y edición
    (
        "view_brand",
        "Ver marca",
        "Ver el listado y detalle de marcas de materiales",
    ),
    (
        "edit_brand",
        "Editar marca",
        "Modificar nombre y datos de una marca existente",
    ),
    # UserDetailView — edición y borrado
    (
        "edit_user",
        "Editar usuario",
        "Modificar datos de un usuario existente (PUT / PATCH)",
    ),
    (
        "delete_user",
        "Eliminar usuario",
        "Borrar (o desactivar) un usuario del sistema (DELETE)",
    ),
    # ReturnableMaterialViewSet — lectura y edición
    (
        "view_returnable",
        "Ver material devolutivo",
        "Ver el listado y detalle de materiales devolutivos",
    ),
    (
        "edit_returnable",
        "Editar material devolutivo",
        "Modificar datos de un material devolutivo existente",
    ),
    # ConsumableMaterialViewSet — lectura y edición
    (
        "view_consumable",
        "Ver material de consumo",
        "Ver el listado y detalle de materiales de consumo",
    ),
    (
        "edit_consumable",
        "Editar material de consumo",
        "Modificar datos de un material de consumo existente",
    ),
    # LoanViewSet — lectura y edición
    (
        "view_loan",
        "Ver préstamo",
        "Ver el listado y detalle de préstamos",
    ),
    (
        "edit_loan",
        "Editar préstamo",
        "Modificar datos de un préstamo existente",
    ),
    # LoanReturnViewSet — creación de devoluciones
    (
        "create_return",
        "Registrar devolución",
        "Registrar la devolución de un préstamo activo",
    ),
    # TaskViewSet — borrado
    (
        "delete_task",
        "Eliminar tarea",
        "Eliminar una tarea del sistema (DELETE)",
    ),
]


def add_missing_permissions(apps, schema_editor):
    """Inserta los permisos que faltan usando get_or_create para ser idempotente."""
    Permission = apps.get_model("permissions", "Permission")

    for codename, name, description in MISSING_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=codename,
            defaults={
                "name": name,
                "description": description,
            },
        )


def remove_missing_permissions(apps, schema_editor):
    """Reversa la migración eliminando solo los permisos añadidos aquí."""
    Permission = apps.get_model("permissions", "Permission")
    codenames = [codename for codename, _, _ in MISSING_PERMISSIONS]
    Permission.objects.filter(codename__in=codenames).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0003_fix_related_names"),
    ]

    operations = [
        migrations.RunPython(
            add_missing_permissions,
            reverse_code=remove_missing_permissions,
        ),
    ]
