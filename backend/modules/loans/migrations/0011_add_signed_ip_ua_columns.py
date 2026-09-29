"""
Adds the four signed_ip/ua columns that migration 0009 incorrectly assumed
already existed in the database (SeparateDatabaseAndState with no SQL).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0010_alter_loans_signed_ip_receptor_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # The ORM state already knows these fields from migration 0009,
            # so we don't touch state_operations — only apply the real SQL.
            state_operations=[],
            database_operations=[
                migrations.RunSQL(
                    sql="ALTER TABLE \"Prestamos\" ADD COLUMN \"signed_ip_responsable\" char(39) NULL;",
                    reverse_sql="SELECT 1;",  # SQLite does not support DROP COLUMN on old versions
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE \"Prestamos\" ADD COLUMN \"signed_ua_responsable\" varchar(500) NULL;",
                    reverse_sql="SELECT 1;",
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE \"Prestamos\" ADD COLUMN \"signed_ip_receptor\" char(39) NULL;",
                    reverse_sql="SELECT 1;",
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE \"Prestamos\" ADD COLUMN \"signed_ua_receptor\" varchar(500) NULL;",
                    reverse_sql="SELECT 1;",
                ),
            ],
        ),
    ]
