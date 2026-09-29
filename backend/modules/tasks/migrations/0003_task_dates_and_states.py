# Ajusta el modelo Task a los requerimientos (RFADMIN46-49):
# - Agrega start_date y end_date (con default solo para filas existentes).
# - Cambia los estados a Pendiente/En progreso/Completada/Cancelada.

import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="start_date",
            field=models.DateField(default=datetime.date.today),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="task",
            name="end_date",
            field=models.DateField(default=datetime.date.today),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="task",
            name="state",
            field=models.CharField(
                choices=[
                    ("Pendiente", "Pendiente"),
                    ("En progreso", "En progreso"),
                    ("Completada", "Completada"),
                    ("Cancelada", "Cancelada"),
                ],
                default="Pendiente",
                max_length=20,
            ),
        ),
    ]
