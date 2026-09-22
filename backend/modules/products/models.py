# Modelos de inventario (productos).

from django.db import models
from django.conf import settings   # para referenciar el modelo de usuario personalizado definido en settings.py


class Brand(models.Model):
    # Marca simple para agrupar materiales.
    name = models.CharField(max_length=100, unique=True)  # UNICO segun diccionario
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Inventory(models.Model):
    # Nombre de inventario: catalogo cerrado de "inventarios" al que se asocia
    # cada material (consumible o devolutivo). Sirve para clasificar el parque
    # fisico: un mismo material puede vivir en distintos inventarios a lo
    # largo de su vida util.
    # Patron espejo de Brand: nombre unico, is_active para soft-delete.
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "Inventarios"
        verbose_name = "Nombre de inventario"
        verbose_name_plural = "Nombres de inventarios"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Category(models.Model):
    # Categoria para clasificar materiales consumibles y devolutivos.
    # Antes era read-only con un set fijo de 3 categorias (seed en 0006);
    # ahora es administrable desde la UI (CRUD en el frontend) con los mismos
    # 3 nombres sembrados como punto de partida.
    name        = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")
    is_active   = models.BooleanField(default=True)

    class Meta:
        verbose_name        = "Categoria"
        verbose_name_plural = "Categorias"
        ordering            = ["name"]

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

    # Cuentadantes: usuarios responsables del material. Un material puede tener
    # N cuentadantes (RF: varios usuarios custodian un mismo material).
    # on_delete=RESTRICT conserva la regla de "no se puede borrar un usuario
    # con materiales asignados" que tenia el FK antiguo.
    cuentadantes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='cuentadante_materials',
        related_query_name='cuentadante_material',
        blank=True,
    )

    # FK a la marca - opcional según requerimiento
    brand = models.ForeignKey(
        Brand,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
    )

    # FK al inventario - opcional. on_delete=SET_NULL para que al "desactivar"
    # o eliminar un inventario, los materiales no queden bloqueados por la
    # restriccion RESTRICT (que usamos en brand/category para obligar a
    # desvincular antes de borrar). En el inventario preferimos desvincular
    # en cascada suave para no romper reportes historicos.
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    # FK a la categoria (antes solo la tenian los devolutivos; ahora se
    # comparte para clasificar consumibles y devolutivos desde un mismo
    # catalogo). Opcional — los 3 nombres sembrados quedan disponibles
    # como punto de partida. on_delete=SET_NULL por la misma razon que
    # `inventory`: desvincular en cascada suave para no romper historial.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
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

    # Fecha de ingreso al inventario (puede diferir de la compra).
    # Obligatoria: todo material registra cuándo ingresó físicamente.
    entry_date = models.DateField(
        default=models.fields.datetime.date.today,
        help_text='Fecha en que el material ingresó al inventario.',
    )

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


class Quotation(models.Model):
    """
    Cotización en PDF para materiales (consumibles o devolutivos).

    Flujo en dos tiempos:
      1. Se sube suelta desde el módulo Cotizaciones (material=NULL).
      2. Al crear/editar un material se elige entre las disponibles
         (1-3 por material, obligatorio al menos una al crear).
    """
    material = models.ForeignKey(
        ConsumableMaterial,
        on_delete=models.SET_NULL,
        related_name='quotations',
        null=True,
        blank=True,
        help_text='Material al que está asignada. Null = disponible en la biblioteca.',
    )
    title = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text='Título para identificarla en el selector. Si se deja vacío se usa el nombre del archivo.',
    )
    file = models.FileField(
        upload_to='quotes/',
        help_text='Archivo de la cotización (PDF).',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quotations'
        ordering = ['uploaded_at']

    def __str__(self):
        label = self.title or (self.file.name.rsplit('/', 1)[-1] if self.file else '?')
        return f'Cotización {self.pk} — {label}'
