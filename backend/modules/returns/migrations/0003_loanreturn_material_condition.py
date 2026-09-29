from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("returns", "0002_loanreturn_returned_quantity"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanreturn",
            name="material_condition",
            field=models.CharField(
                choices=[
                    ("Bueno", "Bueno"),
                    ("Mantenimiento", "Mantenimiento"),
                    ("Baja", "Baja"),
                ],
                default="Bueno",
                max_length=20,
                help_text="Estado en que se recibe el material. Determina si pasa a Disponible, Mantenimiento o Baja.",
            ),
        ),
    ]
