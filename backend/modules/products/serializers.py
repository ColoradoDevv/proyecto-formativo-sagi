# 
# Serializers del modulo products.
# Convierte modelos a JSON y valida lo que llega.
# 

from rest_framework import serializers
from django.db.models import Sum

from .models import Brand, Category, ConsumableMaterial, Inventory, ReturnableMaterial
from modules.users.models import User



class BrandSerializer(serializers.ModelSerializer):
    # Serializer simple para marcas.

    def validate_name(self, value):
        # Unicidad insensible a mayúsculas/minúsculas (SQLite es case-sensitive
        # en UNIQUE, por lo que "SENA" y "sena" coexistirían sin esta guarda).
        qs = Brand.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una marca con ese nombre.")
        return value

    class Meta:
        model = Brand
        fields = "__all__"
        
class CategorySerializer(serializers.ModelSerializer):
    # Serializer del catalogo de categorias (consumibles y devolutivos).
    def validate_name(self, value):
        # Unicidad case-insensitive consistente con Brand/Inventory.
        qs = Category.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una categoria con ese nombre.")
        return value

    class Meta:
        model = Category
        fields = "__all__"


class InventorySerializer(serializers.ModelSerializer):
    """Serializer para el catalogo de nombres de inventario."""
    def validate_name(self, value):
        # Misma politica que BrandSerializer: unicidad case-insensitive.
        qs = Inventory.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un nombre de inventario con ese valor.")
        return value

    class Meta:
        model = Inventory
        fields = "__all__"


class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name']

class ConsumableMaterialSerializer(serializers.ModelSerializer):
    # ── Campos de solo lectura (enriquecidos) ─────────────────────────────
    brand              = BrandSerializer(read_only=True)
    inventory          = InventorySerializer(read_only=True)
    category           = CategorySerializer(read_only=True)
    # `cuentadantes`: lista de usuarios asignados (M2M). Solo lectura; para
    # escritura se usa `cuentadante_ids` (write_only, lista de PKs).
    # Importante: NO usar `source='cuentadantes'` (mismo nombre que el
    # atributo). DRF dispara un AssertionError al construir el fields
    # dict si source == field_name (incluso para read-only). El default
    # (source=None) hace que DRF use el field_name como source, que es
    # exactamente lo que queremos.
    cuentadantes       = UserMinimalSerializer(many=True, read_only=True)
    available_quantity = serializers.SerializerMethodField()
    is_exhausted       = serializers.SerializerMethodField()

    # ── Campos de escritura para archivos ─────────────────────────────────
    # ImageField/FileField aceptan el archivo subido en un POST/PATCH multipart.
    # En to_representation se reemplazan por la URL relativa (/media/...).
    image           = serializers.ImageField(required=False, allow_null=True, allow_empty_file=True, use_url=False)
    technical_sheet = serializers.FileField(required=False,  allow_null=True, allow_empty_file=True, use_url=False)

    # ── Campos de escritura para FKs ──────────────────────────────────────
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        source='brand',
        write_only=True,
        required=False,
        allow_null=True
    )
    # Inventario: opcional. Acepta null/vacio para desasignar.
    inventory_id = serializers.PrimaryKeyRelatedField(
        queryset=Inventory.objects.all(),
        source='inventory',
        write_only=True,
        required=False,
        allow_null=True
    )
    # Categoria: opcional. Compartida con devolutivos; cualquier categoria
    # activa del CRUD /api/products/categories/ es valida.
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )

    # ── Cuentadantes (M2M) — escritura ────────────────────────────────────
    # Lista de IDs de usuarios. Acepta vacia: si llega vacia y el material
    # ya existia, se mantienen los anteriores (PATCH parcial); en create se
    # exigira al menos uno via validate().
    #
    # Importante: NO poner `source='cuentadantes'`. Con `many=True`, DRF
    # envuelve el campo en un `ListSerializer` cuyo field_name interno se
    # deriva del `source`; si source == field_name dispara un AssertionError
    # ("redundant source") que rompe el POST con 500. Sin `source`, el
    # wrapper usa el nombre del atributo (`cuentadante_ids`) y se mapea a
    # `cuentadantes` via `super().create()` en `create()`.
    # El modelo ya expone `cuentadantes` (read-only) por el `fields = "__all__"`,
    # asi que tenemos:
    #   - `cuentadantes`       -> read-only, serializa la lista de usuarios anidada
    #   - `cuentadante_ids`    -> write-only, recibe la lista de PKs en POST/PATCH
    cuentadante_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        write_only=True,
        many=True,
        required=False,
    )

    # ── Métodos computados ────────────────────────────────────────────────

    def get_available_quantity(self, obj):
        if obj.quantity is None:
            return None
        from modules.loans.models import Loans
        # Incluye 'Pendiente' además de 'Activo': un préstamo pendiente de
        # firma ya reserva el stock (LoanSerializer.validate lo exige así
        # al crear un nuevo préstamo), así que el disponible mostrado debe
        # coincidir con lo que realmente se puede reservar.
        already_lent = (
            Loans.objects.filter(id_material=obj, state__in=['Activo', 'Pendiente'])
            .aggregate(total=Sum('amount_lent'))['total'] or 0
        )
        return max(0, obj.quantity - already_lent)

    def get_is_exhausted(self, obj):
        if obj.quantity is None:
            return False
        if obj.quantity <= 0:
            return True
        available = self.get_available_quantity(obj)
        return available is not None and available <= 0

    def to_internal_value(self, data):
        # Un <select> de marca sin elegir nada, o un botón "Eliminar" de
        # foto/ficha técnica, llegan como string vacío "" en el multipart —
        # DRF no trata "" como "ausente" (solo lo hace con la llave faltante
        # o null), así que sin esto PrimaryKeyRelatedField/ImageField/FileField
        # levantan un error crudo en vez de interpretarlo como "sin marca"/
        # "quitar el archivo".
        if hasattr(data, "copy"):
            data = data.copy()
        if data.get("brand_id") == "":
            data["brand_id"] = None

        self._clear_files = []
        for field in ("image", "technical_sheet"):
            if data.get(field) == "":
                del data[field]
                self._clear_files.append(field)

        # DRF con many=True + QueryDict (multipart) necesita la misma key
        # repetida: ?cuentadante_ids=1&cuentadante_ids=2. Esto ya lo hace
        # el frontend al construir el FormData.
        return super().to_internal_value(data)

    def validate_sena_plate(self, value):
        if not value:
            return None
        qs = ConsumableMaterial.objects.filter(sena_plate__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un material con esta placa SENA.")
        return value

    def validate_serial(self, value):
        # Mismo tratamiento que sena_plate: "" se normaliza a None (en vez
        # de guardar un string vacío) para no chocar contra la restricción
        # unique si dos materiales quedan con serial="".
        if not value:
            return None
        qs = ConsumableMaterial.objects.filter(serial__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un material con este número de serie.")
        return value

    def validate(self, data):
        if 'sena_plate' in data or 'quantity' in data:
            sena_plate = data.get('sena_plate')
            quantity   = data.get('quantity')
            if not sena_plate and quantity is None:
                raise serializers.ValidationError({"quantity": "La cantidad es obligatoria si no hay placa SENA."})

        quantity = data.get('quantity')
        if quantity is not None and quantity < 0:
            raise serializers.ValidationError({'quantity': 'El stock no puede ser negativo.'})

        # Reglas de "cuentadantes":
        #   - En create: se exige al menos uno (la lista no puede estar ausente
        #     ni venir vacia). Esto evita que un POST sin `cuentadante_ids` o
        #     con `[]` cree un material huerfano.
        #   - En update (PATCH): si NO se envia `cuentadante_ids` se mantienen
        #     los anteriores (no se obliga a reenviarlos para un PATCH
        #     parcial); si llega una lista (vacia o no) se reemplaza el set.
        if not self.instance:
            ids = data.get('cuentadante_ids')
            if not ids:
                raise serializers.ValidationError(
                    {"cuentadante_ids": "Debe asignar al menos un cuentadante."}
                )

        return data

    def create(self, validated_data):
        # Extraer M2M del validated_data antes del super().create().
        # El nombre es `cuentadante_ids` (write-only), no `cuentadantes`
        # (read-only); ver nota en la declaracion del campo.
        m2m = validated_data.pop('cuentadante_ids', None)
        instance = super().create(validated_data)
        if m2m is not None:
            instance.cuentadantes.set(m2m)
        return instance

    def update(self, instance, validated_data):
        # M2M: solo aplicar si vino en el payload (cuentadante_ids en el
        # request). Si no esta, se preservan los anteriores.
        m2m = validated_data.pop('cuentadante_ids', None)
        instance = super().update(instance, validated_data)
        if m2m is not None:
            instance.cuentadantes.set(m2m)
        # Campos marcados en to_internal_value() como "quitar archivo"
        # (llegaron como "" en vez de un File nuevo).
        clear_files = getattr(self, "_clear_files", [])
        if clear_files:
            for field in clear_files:
                getattr(instance, field).delete(save=False)
            instance.save(update_fields=clear_files)
        return instance

    # ── Serialización de salida ───────────────────────────────────────────

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Reemplazar los valores de ImageField/FileField (rutas relativas del FS)
        # por URLs navegables via el proxy de Vite → /media/<path>.
        rep['image'] = (
            f"/media/{instance.image.name}" if instance.image and instance.image.name else None
        )
        rep['technical_sheet'] = (
            f"/media/{instance.technical_sheet.name}"
            if instance.technical_sheet and instance.technical_sheet.name else None
        )
        # Si el material está agotado, forzar state = "No Disponible" en la respuesta.
        if rep.get('is_exhausted'):
            rep['state'] = 'No Disponible'
        return rep

    class Meta:
        model = ConsumableMaterial
        fields = "__all__"
        extra_kwargs = {
            "sena_plate": {"required": False, "allow_null": True, "allow_blank": True},
            "serial":     {"required": False, "allow_null": True, "allow_blank": True},
            "quantity":   {"required": False, "allow_null": True},
        }


# ── Ficha técnica ─────────────────────────────────────────────────────────────

class TechnicalSheetSerializer(serializers.ModelSerializer):
    """Serializer para una ficha técnica individual."""
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return f"/media/{obj.file.name}" if obj.file and obj.file.name else None

    class Meta:
        from .models import TechnicalSheet
        model  = TechnicalSheet
        fields = ['id', 'url', 'uploaded_at']


class ReturnableMaterialSerializer(serializers.ModelSerializer):
    category        = CategorySerializer(read_only=True)
    technical_sheets = serializers.SerializerMethodField()

    def get_technical_sheets(self, obj):
        from .models import TechnicalSheet
        sheets = TechnicalSheet.objects.filter(material=obj.consumable)
        return TechnicalSheetSerializer(sheets, many=True).data

    class Meta:
        model = ReturnableMaterial
        fields = ['consumable', 'category', 'model', 'serial', 'technical_sheet', 'dimensions', 'technical_sheets']
        extra_kwargs = {
            "serial":         {"required": False, "allow_null": True},
            "dimensions":     {"required": False, "allow_null": True},
            "technical_sheet": {"required": False},
        }

    def to_representation(self, instance):
        rep = super().to_representation(instance)

        # IMPORTANTE: usar el consumable ya asociado a esta instancia,
        # NUNCA crear uno nuevo aquí. to_representation() se ejecuta en
        # cada lectura (GET/list/create response), así que cualquier
        # .objects.create() en este método duplicaría registros en la DB.
        c = instance.consumable

        # Refrescar desde la DB: si esta instancia viene de un create()/save()
        # reciente en la vista (típico con multipart/form-data), los campos
        # numéricos pueden seguir siendo str en memoria (p.ej. "10" en vez
        # de 10), lo que rompe las comparaciones numéricas de abajo.
        c.refresh_from_db()

        rep['consumable_id'] = c.id
        rep['name']          = c.name
        rep['sena_plate']    = c.sena_plate
        rep['state']         = c.state
        rep['quantity']      = c.quantity
        rep['unit_price']    = str(c.unit_price)
        rep['total_price']   = str(c.total_price)
        rep['is_active']     = c.is_active

        # is_exhausted / available_quantity
        if c.quantity is None:
            rep['is_exhausted']       = False
            rep['available_quantity'] = None
        else:
            from modules.loans.models import Loans
            from django.db.models import Sum as _Sum

            qty = int(c.quantity)  # cast defensivo por si vuelve a llegar como str
            # Incluye 'Pendiente' junto con 'Activo' — ver la nota equivalente
            # en ConsumableMaterialSerializer.get_available_quantity.
            already_lent = (
                Loans.objects.filter(id_material=c, state__in=['Activo', 'Pendiente'])
                .aggregate(total=_Sum('amount_lent'))['total'] or 0
            )
            rep['is_exhausted']       = qty <= 0 or max(0, qty - already_lent) == 0
            rep['available_quantity'] = max(0, qty - already_lent)

        if rep['is_exhausted']:
            rep['state'] = 'No Disponible'

        rep['image']        = f"/media/{c.image.name}" if c.image and c.image.name else None
        rep['purchase_date'] = str(c.purchase_date) if c.purchase_date else None
        rep['location']     = c.location
        rep['description']  = c.description
        rep['brand']        = BrandSerializer(c.brand).data if c.brand else None
        rep['inventory']    = InventorySerializer(c.inventory).data if c.inventory else None
        rep['category']     = CategorySerializer(c.category).data if c.category else None

        # Cuentadantes: ahora vienen como lista (M2M) en lugar de un solo
        # objeto. Cada elemento es { id, first_name, last_name }.
        rep['cuentadantes'] = UserMinimalSerializer(c.cuentadantes.all(), many=True).data
        # Mantener compat con clientes viejos que esperan `user` (singular):
        # si hay al menos un cuentadante, expone el primero como `user`.
        first = next(iter(c.cuentadantes.all()), None)
        rep['user']         = UserMinimalSerializer(first).data if first else None

        # Fichas técnicas como lista de { id, url, uploaded_at }
        # (reemplaza el campo legacy technical_sheet de la tabla ReturnableMaterial)
        rep.pop('technical_sheet', None)
        return rep
