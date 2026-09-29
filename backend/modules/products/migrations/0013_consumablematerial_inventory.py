# Migracion 0013 de products:
#   Agrega la FK `inventory` (nullable, SET_NULL) en ConsumableMaterial,
#   para clasificar cada material en un "nombre de inventario" del catalogo.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0012_inventory"),
    ]

    operations = [
        migrations.AddField(
            model_name="consumablematerial",
            name="inventory",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="products.inventory",
            ),
        ),
    ]
