from django.db import migrations


def seed_document_types(apps, schema_editor):
    DocumentType = apps.get_model("users", "DocumentType")
    names = [
        "Cédula de Ciudadanía",
        "Cédula de Extranjería",
        "Tarjeta de Identidad",
        "Permiso Especial de Permanencia",
        "Permiso por Protección Temporal",
    ]
    for name in names:
        DocumentType.objects.get_or_create(name=name)


def reverse_seed_document_types(apps, schema_editor):
    DocumentType = apps.get_model("users", "DocumentType")
    names = [
        "Cédula de Ciudadanía",
        "Cédula de Extranjería",
        "Tarjeta de Identidad",
        "Permiso Especial de Permanencia",
        "Permiso por Protección Temporal",
    ]
    DocumentType.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_add_blacklisted_token"),
    ]

    operations = [
        migrations.RunPython(seed_document_types, reverse_seed_document_types),
    ]
