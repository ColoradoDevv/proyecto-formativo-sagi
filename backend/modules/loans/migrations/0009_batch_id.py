import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Agrega batch_id a Loans y SignOTP para agrupar préstamos multi-material
    en un único lote, emitiendo un solo correo y OTP por rol.

    También registra en el historial de migraciones los campos signed_ip/ua
    que ya existían en la BD (aplicados directamente durante desarrollo).
    SeparateDatabaseAndState no emite SQL para esos campos pero los marca
    como conocidos por el ORM.
    """

    dependencies = [
        ("loans", "0008_signotp"),
    ]

    operations = [
        # ── Campos de auditoría (ya en BD, solo se registran en el estado) ─
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="loans",
                    name="signed_ip_responsable",
                    field=models.GenericIPAddressField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="loans",
                    name="signed_ua_responsable",
                    field=models.CharField(blank=True, max_length=500, null=True),
                ),
                migrations.AddField(
                    model_name="loans",
                    name="signed_ip_receptor",
                    field=models.GenericIPAddressField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="loans",
                    name="signed_ua_receptor",
                    field=models.CharField(blank=True, max_length=500, null=True),
                ),
            ],
            database_operations=[],  # ya existen en la BD
        ),

        # ── batch_id: nuevos campos que sí necesitan ALTER TABLE ───────────
        migrations.AddField(
            model_name="loans",
            name="batch_id",
            field=models.UUIDField(
                blank=True, db_index=True, null=True,
                help_text="UUID compartido por todos los préstamos del mismo lote de creación.",
            ),
        ),
        migrations.AddField(
            model_name="signotp",
            name="batch_id",
            field=models.UUIDField(
                blank=True, db_index=True, null=True,
                help_text="UUID del lote de préstamos que cubre este OTP.",
            ),
        ),
    ]
