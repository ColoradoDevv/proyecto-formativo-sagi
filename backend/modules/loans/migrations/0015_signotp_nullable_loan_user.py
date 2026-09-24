# Permite OTPs de firma de BORRADORES sin préstamo ni usuario.
#
# El flujo draft guardaba el OTP en la caché de Django (locmem): se perdía
# con cada reinicio del servidor (autoreload en desarrollo) y no se
# compartía entre procesos/workers en producción — el código "no existía"
# al confirmarlo. Persistiéndolo en la tabla loan_sign_otps (igual que el
# flujo clásico) el OTP sobrevive reinicios y mult readers.
# - loan: null para OTPs de draft (aún no existe el Loans real).
# - user: null para el receptor externo (sin cuenta).

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0014_loandraft_loan_type_loandraft_receptor_email_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="signotp",
            name="loan",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="otps",
                to="loans.loans",
                help_text="Préstamo representativo del lote. Null en OTPs de borrador (el Loans aún no existe).",
            ),
        ),
        migrations.AlterField(
            model_name="signotp",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sign_otps",
                to=settings.AUTH_USER_MODEL,
                help_text="Usuario que debe ingresar el código. Null para receptor externo (sin cuenta).",
            ),
        ),
    ]
