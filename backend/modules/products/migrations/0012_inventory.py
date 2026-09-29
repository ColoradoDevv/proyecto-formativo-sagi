# Migracion 0012 de products:
#   Crea el catalogo "Inventarios" (nombre de inventario) — espejo de
#   `Brand` pero con `description` opcional y timestamps automaticos.
#   Se usa desde ConsumableMaterial para clasificar el parque fisico.

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0011_consumablematerial_cuentadantes"),
    ]

    operations = [
        migrations.CreateModel(
            name="Inventory",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=100, unique=True)),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True, default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "Inventarios",
                "verbose_name": "Nombre de inventario",
                "verbose_name_plural": "Nombres de inventarios",
                "ordering": ["name"],
            },
        ),
    ]
