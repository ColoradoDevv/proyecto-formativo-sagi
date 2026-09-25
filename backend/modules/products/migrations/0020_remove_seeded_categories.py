from django.db import migrations


# Categorias sembradas por la migracion 0006. Tras la migracion 0019
# (campo `tipo` en ConsumableMaterial), estas 3 categorias son datos
# duplicados del enum: ya no aportan informacion util y pueden
# confundir a usuarios que las eligen pensando que tienen semantica
# propia (cuando en realidad la logica vive en `tipo`).
# El nombre real en la DB era "Herramienta" (singular) segun el seed
# 0006 — 0022 cubre la limpieza del singular. Esta lista incluye las
# dos variantes (singular + plural defensivo) por si algun entorno
# quedo en estado inconsistente.
FIXED_DUPLICATES = (
    "Herramienta",
    "Herramientas",  # defensivo: por si fue creada con plural
    "Maquinaria y Equipos",
    "Muebles y Enseres",
)


def reassign_and_delete_seeded(apps, schema_editor):
    """Reasigna filas que apuntan a una variante de las categorías
    sembradas a una categoría fallback, y luego borra las variantes.

    Reasignamos tanto en ConsumableMaterial como en ReturnableMaterial:
      - ConsumableMaterial.category pasa a NOT NULL en 0021, así que
        no se puede asignar None.
      - ReturnableMaterial.category usa on_delete=RESTRICT, por lo
        que el delete posterior falla si quedan filas apuntando.

    Si esta migración se ejecuta antes de 0021 (fresh install con
    0021 sin aplicar), la reasignacion sigue funcionando porque
    cualquier `category_id` distinto de NULL cumple la futura
    constraint NOT NULL.
    """
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    ReturnableMaterial = apps.get_model("products", "ReturnableMaterial")
    Category = apps.get_model("products", "Category")

    fallback = (
        Category.objects.filter(is_active=True)
        .exclude(name__in=FIXED_DUPLICATES)
        .order_by("name")
        .first()
    )
    if fallback is None:
        fallback = (
            Category.objects.exclude(name__in=FIXED_DUPLICATES)
            .order_by("name")
            .first()
        )
    if fallback is None:
        fallback = Category.objects.create(
            name="General",
            description=(
                "Categoria por defecto. Asignada durante la migracion "
                "0020 para reasignar filas que apuntaban a las "
                "categorias sembradas."
            ),
            is_active=True,
        )

    ConsumableMaterial.objects.filter(
        category__name__in=FIXED_DUPLICATES
    ).update(category=fallback)
    ReturnableMaterial.objects.filter(
        category__name__in=FIXED_DUPLICATES
    ).update(category=fallback)

    Category.objects.filter(name__in=FIXED_DUPLICATES).delete()


def restore_seeded_duplicates(apps, schema_editor):
    """Reversa: vuelve a crear las 3 categorias originales del seed
    0006 (no la variante plural). Idempotente.
    """
    Category = apps.get_model("products", "Category")
    FIXED = (
        "Herramienta",
        "Maquinaria y Equipos",
        "Muebles y Enseres",
    )
    for name in FIXED:
        Category.objects.get_or_create(name=name)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0019_consumablematerial_tipo"),
    ]

    operations = [
        migrations.RunPython(reassign_and_delete_seeded, restore_seeded_duplicates),
    ]
