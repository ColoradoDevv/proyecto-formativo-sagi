# Migracion 0011 de products:
#   - Convierte la FK unica `user` (cuentadante) de ConsumableMaterial en una
#     relacion ManyToMany `cuentadantes`. Asi un material puede tener varios
#     cuentadantes y se mantiene la trazabilidad por usuario.
#   - Antes de eliminar la columna FK, una data migration copia el `user_id`
#     actual de cada material a la nueva tabla through del M2M, de modo que
#     ningun material quede sin al menos un cuentadante tras la migracion.
#   - La columna `ConsumableMaterial.user` desaparece (DROP COLUMN); Django
#     borra automaticamente el FK constraint asociado.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_user_to_cuentadantes(apps, schema_editor):
    """Copia el user_id de cada ConsumableMaterial al M2M `cuentadantes`."""
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    User = apps.get_model("users", "User")

    # Recorremos con .iterator() para no cargar toda la tabla en memoria.
    for material in ConsumableMaterial.objects.exclude(user__isnull=True).iterator():
        try:
            user = User.objects.get(pk=material.user_id)
        except User.DoesNotExist:
            continue
        material.cuentadantes.add(user)


def clear_cuentadantes(apps, schema_editor):
    """Reversa: vacia el M2M (los user_id originales siguen intactos)."""
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    for material in ConsumableMaterial.objects.all():
        material.cuentadantes.clear()


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0010_alter_consumablematerial_brand"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1) Agregar el M2M `cuentadantes` (nullable, blank=True). Django crea
        #    automaticamente la tabla through (consumablematerial_cuentadantes).
        migrations.AddField(
            model_name="consumablematerial",
            name="cuentadantes",
            field=models.ManyToManyField(
                blank=True,
                related_name="cuentadante_materials",
                related_query_name="cuentadante_material",
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # 2) Data migration: copiar user -> M2M antes de eliminar la FK.
        migrations.RunPython(
            copy_user_to_cuentadantes,
            reverse_code=clear_cuentadantes,
        ),

        # 3) Eliminar la FK `user` (la columna y su constraint).
        migrations.RemoveField(
            model_name="consumablematerial",
            name="user",
        ),
    ]
