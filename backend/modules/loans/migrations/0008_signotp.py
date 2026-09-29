import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0007_loans_signature_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SignOTP",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    "loan",
                    models.ForeignKey(
                        help_text="Préstamo al que pertenece este OTP.",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="otps",
                        to="loans.loans",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        help_text="Usuario que debe ingresar el código.",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sign_otps",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        max_length=20,
                        help_text="'responsable' o 'receptor'.",
                    ),
                ),
                (
                    "code_hash",
                    models.CharField(
                        max_length=64,
                        help_text="SHA-256 del código OTP. Nunca se almacena en claro.",
                    ),
                ),
                (
                    "expires_at",
                    models.DateTimeField(
                        help_text="Momento en que el OTP deja de ser válido.",
                    ),
                ),
                (
                    "used",
                    models.BooleanField(
                        default=False,
                        help_text="True una vez que el código fue verificado correctamente.",
                    ),
                ),
                (
                    "attempts",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="Intentos fallidos acumulados. Al llegar a 5 se invalida.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "loan_sign_otps",
                "verbose_name": "OTP de firma",
                "verbose_name_plural": "OTPs de firma",
            },
        ),
    ]
