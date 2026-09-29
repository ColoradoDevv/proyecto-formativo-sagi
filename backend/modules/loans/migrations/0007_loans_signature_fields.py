# Migración manual para la firma electrónica en préstamos.
# Agrega los campos de trazabilidad de firma y activa el estado 'Pendiente'.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0006_remove_loans_id_user_loans_id_receptor_user_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Activar 'Pendiente' como opción válida del campo state
        #    y cambiar el default a 'Pendiente'.
        migrations.AlterField(
            model_name="loans",
            name="state",
            field=models.CharField(
                choices=[
                    ("Pendiente", "Pendiente"),
                    ("Activo", "Activo"),
                    ("Finalizado", "Finalizado"),
                    ("Incompleto", "Incompleto"),
                ],
                default="Pendiente",
                max_length=20,
            ),
        ),

        # 2. Campos de trazabilidad: quién firmó como responsable y cuándo.
        migrations.AddField(
            model_name="loans",
            name="signed_by_responsable",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="firmas_responsable",
                to=settings.AUTH_USER_MODEL,
                help_text="Usuario que firmó como responsable del préstamo.",
            ),
        ),
        migrations.AddField(
            model_name="loans",
            name="signed_at_responsable",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Fecha y hora en que el responsable firmó.",
            ),
        ),

        # 3. Campos de trazabilidad: quién firmó como receptor y cuándo.
        migrations.AddField(
            model_name="loans",
            name="signed_by_receptor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="firmas_receptor",
                to=settings.AUTH_USER_MODEL,
                help_text="Usuario que firmó como receptor del préstamo.",
            ),
        ),
        migrations.AddField(
            model_name="loans",
            name="signed_at_receptor",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Fecha y hora en que el receptor firmó.",
            ),
        ),
    ]
