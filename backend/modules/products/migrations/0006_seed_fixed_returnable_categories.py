from django.db import migrations


FIXED_CATEGORIES = (
    "Herramienta",
    "Maquinaria y Equipos",
    "Muebles y Enseres",
)


def seed_fixed_categories(apps, schema_editor):
    Category = apps.get_model("products", "Category")

    for name in FIXED_CATEGORIES:
        Category.objects.get_or_create(name=name)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0005_add_technical_sheet_to_consumable"),
    ]

    operations = [
        migrations.RunPython(seed_fixed_categories, migrations.RunPython.noop),
    ]
