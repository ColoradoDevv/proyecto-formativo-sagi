# Modelos de inventario (productos).

from django.db import models
from django.conf import settings   # para referenciar el modelo de usuario personalizado definido en settings.py


class Brand(models.Model):
    # Marca simple para agrupar materiales.
    name = models.CharField(max_length=100, unique=True)  # UNICO segun diccionario
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    # Categoria para ordenar el inventario.
    name = models.CharField(max_length=100, unique=True)  # UNICO segun diccionario

    def __str__(self):
        return self.name


class ConsumableMaterial(models.Model):
    # Material consumible con estado y cantidad.
    # Tambien sirve como tabla base para materiales devolutivos.

    STATE_CHOICES = [
        ('Disponible', 'Disponible'),
        ('No Disponible', 'No Disponible'),
        ('Mantenimiento', 'Mantenimiento'),
        ('Traslado', 'Traslado'),
        ('En prestamo', 'En prestamo'),
        ('Baja', 'Baja'),
    ]

    # FK al usuario responsable - obligatorio segun diccionario
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        null=False
    )

    # FK a la marca - opcional según requerimiento
    brand = models.ForeignKey(
        Brand,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
    )


    # Placa SENA: unica, pero opcional (solo obligatoria si no es consumible puro)
    sena_plate = models.CharField(max_length=20, unique=True, null=True)

    # Placa S/N: unica, pero opcional (solo obligatoria si no es consumible puro)
    serial = models.CharField(max_length=20, unique=True, null=True)

    # Nombre obligatorio segun diccionario
    name = models.CharField(max_length=100)

    image = models.ImageField(upload_to='materials/', blank=True, default='')

    # Ficha tecnica del material (PDF, Excel, PNG). Opcional segun diccionario.
    technical_sheet = models.FileField(upload_to='specs/consumables/', blank=True, default='')

    # Cantidad: obligatoria solo si el material no tiene placa
    quantity = models.IntegerField(null=True)

    # Precios obligatorios segun diccionario
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    total_price = models.DecimalField(max_digits=15, decimal_places=2)

    # Estado obligatorio segun diccionario
    state = models.CharField(max_length=20, choices=STATE_CHOICES)
    
    is_active = models.BooleanField(default=True)  # Default 1 segun diccionario


    # Descripcion obligatoria segun diccionario
    description = models.CharField(max_length=255)

    # Fecha de compra obligatoria segun diccionario
    purchase_date = models.DateField()

    # Ubicacion obligatoria segun diccionario
    location = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.name


class ReturnableMaterial(models.Model):
    # Material devolutivo con datos tecnicos adicionales.
    # Hereda datos base de ConsumableMaterial via OneToOneField como PK.

    # PK y FK a la vez - segun diccionario id_material es PK+FK
    consumable = models.OneToOneField(
        ConsumableMaterial,
        on_delete=models.RESTRICT,
        primary_key=True
    )

    # FK a categoria - obligatorio segun diccionario
    category = models.ForeignKey(
        Category,
        on_delete=models.RESTRICT,
        null=False
    )

    # Obligatorio segun diccionario
    model = models.CharField(max_length=100)

    # Unico y opcional (segun categoria, ej. Herramienta)
    serial = models.CharField(max_length=20, unique=True, null=True, blank=True)

    technical_sheet = models.FileField(upload_to='specs/', blank=True, default='')

    # Dimensiones: opcional segun diccionario (obligatorio: No)
    dimensions = models.CharField(max_length=100, null=True)

    def __str__(self):
        return self.consumable.name


class TechnicalSheet(models.Model):
    """
    Ficha técnica de un material devolutivo.
    Un devolutivo puede tener 1-3 fichas (PDF, Excel o PNG).
    """
    material = models.ForeignKey(
        ConsumableMaterial,
        on_delete=models.CASCADE,
        related_name='technical_sheets',
        help_text='Material al que pertenece esta ficha técnica.',
    )
    file = models.FileField(
        upload_to='specs/returnables/',
        help_text='Archivo de la ficha técnica (PDF, Excel o PNG).',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'technical_sheets'
        ordering = ['uploaded_at']

    def __str__(self):
        return f'Ficha {self.pk} — material {self.material_id}'
