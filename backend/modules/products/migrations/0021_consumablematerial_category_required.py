from django.db import migrations, models
import django.db.models.deletion


def ensure_no_null_categories(apps, schema_editor):
    """Antes de pasar `category` a NOT NULL hay que garantizar que no
    quedan ConsumableMaterial con FK NULL. Origenes posibles:
      - Migracion 0020 (deja NULL las filas que apuntaban a las 3
        categorias sembradas).
      - Materiales creados antes/despues por formularios que no
        exigian categoria.

    Estrategia: si existen NULLs, asignar una categoria fallback.
    Prioridad:
      1. Una categoria activa cualquiera (orden alfabetico).
      2. La primera categoria existente (aunque este inactiva).
      3. Si el catalogo esta completamente vacio, crear "General".

    Las migraciones son idempotentes — volver a aplicar no genera
    duplicados gracias a `get_or_create` / `filter().first()`.
    """
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    Category = apps.get_model("products", "Category")

    null_qs = ConsumableMaterial.objects.filter(category__isnull=True)
    count = null_qs.count()
    if count == 0:
        return

    fallback = (
        Category.objects.filter(is_active=True)
        .order_by("name")
        .first()
    )
    if fallback is None:
        fallback = Category.objects.order_by("name").first()
    if fallback is None:
        fallback = Category.objects.create(
            name="General",
            description=(
                "Categoria por defecto. Asignada durante la migracion "
                "a categoria obligatoria."
            ),
            is_active=True,
        )

    null_qs.update(category=fallback)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0020_remove_seeded_categories"),
    ]

    operations = [
        # 1) Data migration defensiva: ninguna fila debe quedar con
        #    category=NULL antes del AlterField.
        migrations.RunPython(ensure_no_null_categories, migrations.RunPython.noop),
        # 2) AlterField: hacemos la columna NOT NULL. on_delete=RESTRICT
        #    cambia respecto a la version anterior (SET_NULL) para que
        #    no haya forma de "borrar la categoria y dejar el campo a
        #    NULL" — si se quiere desactivar, usar is_active=False en
        #    su lugar.
        migrations.AlterField(
            model_name="consumablematerial",
            name="category",
            field=models.ForeignKey(
                blank=False,
                null=False,
                on_delete=django.db.models.deletion.RESTRICT,
                to="products.category",
            ),
        ),
    ]
