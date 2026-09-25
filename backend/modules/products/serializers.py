# 
# Serializers del modulo products.
# Convierte modelos a JSON y valida lo que llega.
# 

from rest_framework import serializers
from django.db.models import Sum
from sia_api.file_validation import (
    validate_image_file,
    validate_sheet_file,
    validate_quotation_file,
    QUOTATION_MAX_FILES,
)

from .models import Brand, Category, ConsumableMaterial, Inventory, Quotation, ReturnableMaterial
from modules.users.models import User


def save_quotations(material, files, require_min=True):
    """Guarda cotizaciones (claves quotation / quotation_0..N del multipart).

    Valida PDF ≤3MB y tope de 3 por material. En creación exige al menos una.
    `files` es request.FILES (o dict). Devuelve los PKs creados.
    Lanza serializers.ValidationError.
    """
    from django.core.exceptions import ValidationError as DjangoValidationError

    created_ids = []
    new_files = [
        files[key] for key in sorted(files.keys())
        if key == 'quotation' or key.startswith('quotation_')
    ]
    if require_min and not new_files:
        raise serializers.ValidationError(
            {"quotations": "Debe adjuntar al menos una cotización en PDF."}
        )
    if not new_files:
        return created_ids
    existing = material.quotations.count()
    if existing + len(new_files) > QUOTATION_MAX_FILES:
        raise serializers.ValidationError(
            {"quotations": f"Un material puede tener máximo {QUOTATION_MAX_FILES} cotizaciones."}
        )
    for upload in new_files:
        try:
            validate_quotation_file(upload)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"quotations": exc.messages})
        created = Quotation.objects.create(material=material, file=upload)
        created_ids.append(created.pk)
    return created_ids


def _quotation_id_list(data, key="quotation_ids"):
    """Lee lista de IDs desde multipart (claves repetidas) o JSON (array)."""
    if hasattr(data, "getlist"):
        raw = data.getlist(key)
        # QueryDict.getlist en JSON-parseado no aplica; si viene un solo
        # valor con comas no se parte: los IDs son numéricos simples.
        out = []
        for item in raw:
            if isinstance(item, list):
                out.extend(item)
            else:
                out.append(item)
        return out
    value = data.get(key, [])
    return value if isinstance(value, list) else [value]


def assign_quotations(material, id_list):
    """Conciliación total: asigna las listadas y libera las que ya no están.

    Cada ID debe existir y estar libre o ya asignada a este material.
    Respeta el tope de 3. Lanza serializers.ValidationError.
    """
    seen, unique = set(), []
    for raw in (id_list or []):
        sid = str(raw).strip()
        if sid and sid not in seen:
            seen.add(sid)
            unique.append(sid)
    if len(unique) > QUOTATION_MAX_FILES:
        raise serializers.ValidationError(
            {"quotations": f"Un material puede tener máximo {QUOTATION_MAX_FILES} cotizaciones."}
        )
    quotes = list(Quotation.objects.filter(pk__in=unique))
    if len(quotes) != len(unique):
        raise serializers.ValidationError(
            {"quotations": "Alguna de las cotizaciones elegidas no existe."}
        )
    for quote in quotes:
        if quote.material_id is not None and quote.material_id != material.pk:
            raise serializers.ValidationError(
                {"quotations": f"La cotización '{quote.title or quote.pk}' ya está asignada a otro material."}
            )
    Quotation.objects.filter(material=material).exclude(pk__in=unique).update(material=None)
    for quote in quotes:
        if quote.material_id != material.pk:
            quote.material = material
            quote.save(update_fields=["material"])



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


def lent_total_for(obj):
    """Total prestado (Activo+Pendiente) para un ConsumableMaterial.

    Usa la anotación `_lent_total` cuando el queryset la trae (listados:
    1 sola query para todas las filas); si no, cae al aggregate puntual
    (detalle/creación: 1 query).
    """
    annotated = getattr(obj, "_lent_total", None)
    if annotated is not None:
        return annotated
    from modules.loans.models import Loans
    return (
        Loans.objects.filter(id_material=obj, state__in=['Activo', 'Pendiente'])
        .aggregate(total=Sum('amount_lent'))['total'] or 0
    )


def lent_subquery(field="pk"):
    """Subquery reutilizable para anotar `_lent_total` en listados."""
    from django.db.models import OuterRef, Subquery, Sum as _Sum, IntegerField
    from django.db.models.functions import Coalesce
    from modules.loans.models import Loans
    sq = (
        Loans.objects.filter(id_material=OuterRef(field), state__in=['Activo', 'Pendiente'])
        .order_by()
        .values("id_material")
        .annotate(t=_Sum("amount_lent"))
        .values("t")
    )
    return Coalesce(Subquery(sq, output_field=IntegerField()), 0)

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
    image           = serializers.ImageField(required=False, allow_null=True, allow_empty_file=True, use_url=False, validators=[validate_image_file])
    technical_sheet = serializers.FileField(required=False,  allow_null=True, allow_empty_file=True, use_url=False, validators=[validate_sheet_file])

    # Fecha de ingreso: obligatoria (el default del modelo solo existe para
    # rellenar filas históricas en la migración; la API siempre la exige).
    entry_date = serializers.DateField(required=True)

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
        # Incluye 'Pendiente' además de 'Activo': un préstamo pendiente de
        # firma ya reserva el stock (LoanSerializer.validate lo exige así
        # al crear un nuevo préstamo), así que el disponible mostrado debe
        # coincidir con lo que realmente se puede reservar.
        return max(0, obj.quantity - lent_total_for(obj))

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

    def _quotation_inputs(self):
        """Devuelve (files, ids) de cotizaciones del request actual."""
        request = self.context.get("request")
        files = getattr(request, "FILES", None) or {}
        data = getattr(request, "data", None) or {}
        return files, _quotation_id_list(data)

    def _save_quotations(self, instance, require_min):
        request = self.context.get("request")
        files = getattr(request, "FILES", None) if request else None
        if not files:
            if require_min:
                raise serializers.ValidationError(
                    {"quotations": "Debe adjuntar al menos una cotización en PDF."}
                )
            return
        save_quotations(instance, files, require_min=require_min)

    def _link_quotations(self, instance, files, ids, require_min, full_replace):
        """Une archivos nuevos + IDs elegidos.

        Con full_replace=True concilia el set completo (edición con picker);
        con False solo agrega lo nuevo sin tocar lo existente.
        """
        created_ids = save_quotations(
            instance, files, require_min=require_min and not ids,
        )
        if full_replace and (ids or created_ids):
            assign_quotations(
                instance, ids + [str(pk) for pk in created_ids],
            )

    def create(self, validated_data):
        # Extraer M2M del validated_data antes del super().create().
        # El nombre es `cuentadante_ids` (write-only), no `cuentadantes`
        # (read-only); ver nota en la declaracion del campo.
        m2m = validated_data.pop('cuentadante_ids', None)
        instance = super().create(validated_data)
        if m2m is not None:
            instance.cuentadantes.set(m2m)
        # Cotizaciones: archivos nuevos (quotation_N) y/o IDs de la
        # biblioteca (quotation_ids). Obligatorio al menos uno al crear.
        files, ids = self._quotation_inputs()
        if not files and not ids:
            raise serializers.ValidationError(
                {"quotations": "Debe elegir al menos una cotización."}
            )
        self._link_quotations(instance, files, ids, require_min=True, full_replace=True)
        return instance

    def update(self, instance, validated_data):
        # M2M: solo aplicar si vino en el payload (cuentadante_ids en el
        # request). Si no esta, se preservan los anteriores.
        m2m = validated_data.pop('cuentadante_ids', None)
        instance = super().update(instance, validated_data)
        if m2m is not None:
            instance.cuentadantes.set(m2m)
        # Cotizaciones nuevas en el PATCH (se agregan a las existentes), o
        # conciliación total si viene quotation_ids.
        files, ids = self._quotation_inputs()
        request = self.context.get("request")
        data = getattr(request, "data", None) or {}
        has_files = bool(files) and any(
            key == 'quotation' or key.startswith('quotation_')
            for key in files.keys()
        )
        has_ids = 'quotation_ids' in data
        if has_files or has_ids:
            self._link_quotations(instance, files, ids, require_min=False, full_replace=has_ids)
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
        rep['quotations'] = QuotationSerializer(
            instance.quotations.all(), many=True
        ).data
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


class QuotationSerializer(serializers.ModelSerializer):
    """Serializer del módulo Cotizaciones (biblioteca independiente).

    Lectura: id, title, file→url, material asignado. Escritura: file (PDF,
    obligatorio al subir) + title opcional (por defecto, el nombre del
    archivo) + material opcional (normalmente null: queda disponible).
    """
    url = serializers.SerializerMethodField()
    material_name = serializers.SerializerMethodField()
    file = serializers.FileField(
        required=False, allow_null=True, use_url=False,
        validators=[validate_quotation_file],
    )

    def get_url(self, obj):
        return f"/media/{obj.file.name}" if obj.file and obj.file.name else None

    def get_material_name(self, obj):
        return obj.material.name if obj.material_id else None

    def validate(self, data):
        if not self.instance and not data.get("file"):
            raise serializers.ValidationError(
                {"file": "Debe adjuntar el PDF de la cotización."}
            )
        return data

    class Meta:
        from .models import Quotation
        model = Quotation
        fields = ['id', 'title', 'file', 'url', 'uploaded_at', 'material', 'material_name']
        extra_kwargs = {
            "material": {"required": False, "allow_null": True},
            "title": {"required": False, "allow_blank": True},
        }


class ReturnableMaterialSerializer(serializers.ModelSerializer):
    category        = CategorySerializer(read_only=True)
    technical_sheets = serializers.SerializerMethodField()

    def get_technical_sheets(self, obj):
        # Usa la relación prefetchada por la vista (sin .filter(): eso
        # dispararía una query por fila aunque exista prefetch).
        sheets = obj.consumable.technical_sheets.all()
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

        rep['consumable_id'] = c.id
        rep['name']          = c.name
        rep['sena_plate']    = c.sena_plate
        rep['state']         = c.state
        rep['quantity']      = c.quantity
        rep['unit_price']    = str(c.unit_price)
        rep['total_price']   = str(c.total_price)
        rep['is_active']     = c.is_active

        # is_exhausted / available_quantity con UNA sola query para todo el
        # listado: la vista anota `_lent_total` en cada fila. Sin refresh ni
        # aggregates por fila (antes: 3 queries por devolutivo).
        # Incluye 'Pendiente' junto con 'Activo' — ver la nota equivalente
        # en ConsumableMaterialSerializer.get_available_quantity.
        if getattr(instance, "_lent_total", None) is not None:
            already_lent = instance._lent_total
        else:
            already_lent = lent_total_for(c)
        if c.quantity is None:
            rep['is_exhausted']       = False
            rep['available_quantity'] = None
        else:
            qty = int(c.quantity)  # cast defensivo por si vuelve a llegar como str
            rep['is_exhausted']       = qty <= 0 or max(0, qty - already_lent) == 0
            rep['available_quantity'] = max(0, qty - already_lent)

        if rep['is_exhausted']:
            rep['state'] = 'No Disponible'

        rep['image']        = f"/media/{c.image.name}" if c.image and c.image.name else None
        rep['purchase_date'] = str(c.purchase_date) if c.purchase_date else None
        rep['entry_date']    = str(c.entry_date) if c.entry_date else None
        rep['location']     = c.location
        rep['description']  = c.description
        rep['brand']        = BrandSerializer(c.brand).data if c.brand else None
        rep['inventory']    = InventorySerializer(c.inventory).data if c.inventory else None
        rep['category']     = CategorySerializer(c.category).data if c.category else None
        # `tipo` ahora vive en ConsumableMaterial y se replica en la respuesta
        # del ReturnableMaterial para que el frontend lo consuma en el mismo
        # payload que ya usa para category/brand/inventory.
        rep['tipo']         = c.tipo

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

        # Cotizaciones como lista de { id, url, uploaded_at }
        # (.all() sin order_by extra: el prefetch de la vista ya las trae
        # ordenadas por Meta.ordering; reordenar rompería el prefetch).
        rep['quotations'] = QuotationSerializer(
            c.quotations.all(), many=True
        ).data
        return rep
