from django.db import migrations


# La migración 0006 sembraba 3 categorías. El nombre real insertado por
# Django era "Herramienta" (singular, sin 's' final) según el seed original,
# pero la migración 0020 listó "Herramientas" (plural) — cadena que NUNCA
# se insertó en la DB. Por eso quedaron filas sueltas de "Herramienta".
# Esta migración borra cualquier variante del nombre sembrado para
# garantizar la limpieza completa.
SEEDED_CATEGORY_VARIANTS = (
    "Herramienta",
    "Herramientas",  # defensivo: por si en algún entorno se insertó el plural
    "Maquinaria y Equipos",
    "Muebles y Enseres",
)


def reassign_and_delete_seeded(apps, schema_editor):
    """Reasigna filas que apuntan a una variante de las categorías
    sembradas a una categoría fallback, y luego borra las variantes.

    Restricciones a respetar:
      - ConsumableMaterial.category es NOT NULL desde 0021 (no se
        puede asignar None).
      - ReturnableMaterial.category usa on_delete=RESTRICT (no se
        puede borrar una categoria apuntada por un RM).

    Por eso reasignamos ANTES de borrar, y lo hacemos en AMBAS tablas
    (ConsumableMaterial y ReturnableMaterial) para no dejar FKs rotas.
    """
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    ReturnableMaterial = apps.get_model("products", "ReturnableMaterial")
    Category = apps.get_model("products", "Category")

    fallback = (
        Category.objects.filter(is_active=True)
        .exclude(name__in=SEEDED_CATEGORY_VARIANTS)
        .order_by("name")
        .first()
    )
    if fallback is None:
        fallback = (
            Category.objects.exclude(name__in=SEEDED_CATEGORY_VARIANTS)
            .order_by("name")
            .first()
        )
    if fallback is None:
        fallback = Category.objects.create(
            name="Sin categoría",
            description=(
                "Categoría por defecto. Asignada durante la migración "
                "0022 para reasignar filas que apuntaban a las 3 "
                "categorías sembradas y poder borrarlas."
            ),
            is_active=True,
        )

    # Reasignar en ConsumableMaterial.
    ConsumableMaterial.objects.filter(
        category__name__in=SEEDED_CATEGORY_VARIANTS
    ).update(category=fallback)
    # Reasignar en ReturnableMaterial (FK con on_delete=RESTRICT — si
    # quedan filas apuntando a las variantes, el .delete() de abajo
    # falla con RestrictedError).
    ReturnableMaterial.objects.filter(
        category__name__in=SEEDED_CATEGORY_VARIANTS
    ).update(category=fallback)

    Category.objects.filter(name__in=SEEDED_CATEGORY_VARIANTS).delete()


def restore_seeded_category_variants(apps, schema_editor):
    """Reversa: vuelve a crear las 3 categorías originales con el seed
    exacto de 0006. La variante plural ("Herramientas") no se restaura
    porque 0006 nunca la sembró.
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
        ("products", "0021_consumablematerial_category_required"),
    ]

    operations = [
        # Reasignar en CM y RM, luego borrar las variantes.
        migrations.RunPython(reassign_and_delete_seeded, restore_seeded_category_variants),
    ]
