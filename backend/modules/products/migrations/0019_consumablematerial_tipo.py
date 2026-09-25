from django.db import migrations, models


# Mapeo nombre_categoria_normalizado -> tipo. Si en el futuro se ajustan
# los nombres del catalogo solo hay que tocar este dict; el resto del
# backfill se mantiene.
CATEGORY_TO_TIPO = {
    "herramienta":          "herramientas",
    "herramientas":         "herramientas",
    "maquinaria y equipos": "maquinaria",
    "maquinaria":           "maquinaria",
    "muebles y enseres":    "muebles",
    "muebles":              "muebles",
}


def backfill_tipo_from_category(apps, schema_editor):
    """Asigna `tipo` segun la categoria asociada a cada material.

    Solo se ejecuta en datos: la columna ya existe con default NULL tras
    la operacion previa (AddField). Si una fila tiene `category` NULL o
    con un nombre no mapeado, queda `tipo=NULL` para revision manual.
    """
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    updated = 0
    skipped = 0
    for cm in ConsumableMaterial.objects.all().only("id", "tipo", "category"):
        if cm.tipo:  # ya viene con un valor (rara vez, pero defensivo)
            continue
        cat_name = (cm.category.name if cm.category_id else "") or ""
        key = cat_name.strip().lower()
        mapped = CATEGORY_TO_TIPO.get(key)
        if mapped is None:
            skipped += 1
            continue
        cm.tipo = mapped
        cm.save(update_fields=["tipo"])
        updated += 1
    # Sin logging/print intencional: la migracion debe ser idempotente.


def noop_reverse(apps, schema_editor):
    """Reversa: vuelve `tipo` a NULL. No restauramos los nombres de categoria."""
    ConsumableMaterial = apps.get_model("products", "ConsumableMaterial")
    ConsumableMaterial.objects.exclude(tipo=None).update(tipo=None)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0018_quotation_title_alter_quotation_material"),
    ]

    operations = [
        # 1) AddField: la columna nace NULL para no romper filas existentes.
        #    default=None se omite explicitamente para evitar la migracion
        #    "prompted" interactiva de Django.
        migrations.AddField(
            model_name="consumablematerial",
            name="tipo",
            field=models.CharField(
                blank=True,
                choices=[
                    ("herramientas", "Herramientas"),
                    ("maquinaria",   "Equipo y Maquinaria"),
                    ("muebles",      "Muebles y Enseres"),
                ],
                help_text="Tipo de material. Determina reglas de placa SENA y dimensiones.",
                max_length=20,
                null=True,
            ),
        ),
        # 2) RunPython: data migration que rellena `tipo` segun `category.name`.
        migrations.RunPython(backfill_tipo_from_category, noop_reverse),
    ]
