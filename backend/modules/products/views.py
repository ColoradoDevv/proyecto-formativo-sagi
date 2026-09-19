# Vistas del modulo productos.
# Aqui viven los endpoints CRUD.

from django.db import transaction, IntegrityError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models.functions import Lower
from django.db.models import Count

from .models import Brand, Category, ConsumableMaterial, ReturnableMaterial

from .models import Brand, Category, ConsumableMaterial, ReturnableMaterial
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ConsumableMaterialSerializer,
    ReturnableMaterialSerializer,
)
from modules.permissions.permissions_drf import HasPermission
from modules.audit.mixins import AuditMixin
from modules.audit.utils import log as audit_log
from modules.audit.models import AuditLog
from modules.audit.signals import audit_toggle_active


FIXED_RETURNABLE_CATEGORY_NAMES = (
    "Herramienta",
    "Maquinaria y Equipos",
    "Muebles y Enseres",
)


class BrandViewSet(AuditMixin, viewsets.ModelViewSet):
    # CRUD de marcas.
    queryset = Brand.objects.all().order_by(Lower("name"))
    serializer_class = BrandSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields    = ['name']
    ordering_fields  = ['name', 'id']

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_brand")]
        if self.action == "create":
            return [HasPermission("create_brand")]
        if self.action in ("update", "partial_update"):
            return [HasPermission("edit_brand")]
        # destroy y cualquier acción desconocida — solo superusuarios
        from modules.permissions.permissions_drf import IsSuperUser
        return [IsSuperUser()]


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    # Las categorías de devolutivos están definidas por el RFADMIN08.
    # Solo se consultan: no se pueden crear, editar ni eliminar desde la API.
    queryset = Category.objects.filter(name__in=FIXED_RETURNABLE_CATEGORY_NAMES).order_by("id")
    serializer_class = CategorySerializer

    def get_permissions(self):
        return [HasPermission("view_returnable")]


class ConsumableMaterialViewSet(AuditMixin, viewsets.ModelViewSet):
    # CRUD de materiales consumibles.
    queryset = ConsumableMaterial.objects.all().order_by(Lower("name"))
    serializer_class = ConsumableMaterialSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        'name':      ['icontains', 'exact'],
        'state':     ['exact'],
        'is_active': ['exact'],
        'brand':     ['exact'],       # ?brand=<id>
        'user':      ['exact'],       # ?user=<id>  (cuentadante)
    }
    search_fields   = ['name', 'description', 'sena_plate', 'location']
    ordering_fields = ['name', 'state', 'is_active', 'purchase_date', 'id']

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_consumable")]
        if self.action == "create":
            return [HasPermission("create_consumable")]
        if self.action in ("update", "partial_update", "toggle_active"):
            return [HasPermission("edit_consumable")]
        from modules.permissions.permissions_drf import IsSuperUser
        return [IsSuperUser()]

    def destroy(self, request, *args, **kwargs):
        from django.db.models.deletion import RestrictedError
        try:
            return super().destroy(request, *args, **kwargs)
        except RestrictedError:
            return Response(
                {"error": "No se puede eliminar: el material tiene préstamos u otros registros asociados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["patch"])
    def toggle_active(self, request, pk=None):
        """
        Activa o desactiva un material consumible.
        PATCH /consumables/{id}/toggle_active/
        Body: {"is_active": true | false}
        """
        material = self.get_object()

        is_active = request.data.get("is_active")
        if is_active is None:
            return Response(
                {"error": "El campo 'is_active' es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material.is_active = bool(is_active)
        # Un material inactivo no puede conservar un estado operativo.
        # Al reactivarlo solo se restaura la disponibilidad si fue desactivado
        # mediante este flujo; los demás estados (p. ej. Mantenimiento) se respetan.
        if not material.is_active:
            material.state = "No Disponible"
        elif material.state == "No Disponible":
            material.state = "Disponible"
        material.save(update_fields=["is_active", "state"])

        audit_toggle_active.send(
            sender=ConsumableMaterial,
            instance=material,
            is_active=material.is_active,
            request=request,
            module=AuditLog.MODULE_CONSUMABLES,
        )

        return Response(
            {
                "message": f"Material '{material.name}' {'activado' if material.is_active else 'desactivado'} correctamente.",
                "is_active": material.is_active,
                "state": material.state,
            },
            status=status.HTTP_200_OK,
        )


class ReturnableMaterialViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = ReturnableMaterial.objects.select_related(
        'consumable', 'consumable__brand', 'consumable__user', 'category'
    ).all().order_by(Lower("consumable__name"))
    serializer_class = ReturnableMaterialSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        'consumable__name':      ['icontains', 'exact'],
        'consumable__state':     ['exact'],
        'consumable__is_active': ['exact'],
        'consumable__user':      ['exact'],   # ?consumable__user=<id>  (cuentadante)
        'category':              ['exact'],   # ?category=<id>
        'serial':                ['icontains', 'exact'],
    }
    search_fields   = ['consumable__name', 'consumable__description',
                       'consumable__sena_plate', 'serial', 'model']
    ordering_fields = ['consumable__name', 'consumable__state', 'consumable_id']

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_returnable")]
        if self.action == "create":
            return [HasPermission("create_returnable")]
        if self.action in ("update", "partial_update", "toggle_active"):
            return [HasPermission("edit_returnable")]
        from modules.permissions.permissions_drf import IsSuperUser
        return [IsSuperUser()]

    @staticmethod
    def validate_fixed_category(category_id, current_category_id=None):
        if str(category_id) == str(current_category_id):
            return

        if not Category.objects.filter(
            pk=category_id,
            name__in=FIXED_RETURNABLE_CATEGORY_NAMES,
        ).exists():
            raise ValidationError({
                "category_id": "Debe seleccionar una de las categorías fijas permitidas.",
            })

    @action(detail=True, methods=["patch"])
    def toggle_active(self, request, pk=None):
        """
        Activa o desactiva el ConsumableMaterial subyacente de un devolutivo.
        PATCH /returnables/{id}/toggle_active/
        Body: {"is_active": true | false}

        Los devolutivos no tienen is_active propio: el estado vive en el
        ConsumableMaterial al que están vinculados mediante la relación
        OneToOne consumable → ConsumableMaterial.
        """
        rm = self.get_object()
        consumable = rm.consumable

        is_active = request.data.get("is_active")
        if is_active is None:
            return Response(
                {"error": "El campo 'is_active' es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        consumable.is_active = bool(is_active)
        if not consumable.is_active:
            consumable.state = "No Disponible"
        elif consumable.state == "No Disponible":
            consumable.state = "Disponible"
        consumable.save(update_fields=["is_active", "state"])

        audit_toggle_active.send(
            sender=ReturnableMaterial,
            instance=rm,
            is_active=consumable.is_active,
            request=request,
            module=AuditLog.MODULE_RETURNABLES,
        )

        return Response(
            {
                "message": f"Material '{consumable.name}' {'activado' if consumable.is_active else 'desactivado'} correctamente.",
                "is_active": consumable.is_active,
                "state": consumable.state,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        data = request.data
        files = request.FILES
        category_id = data.get("category_id")
        self.validate_fixed_category(category_id)

        category = Category.objects.filter(pk=category_id).first()
        cat_name = category.name.strip().lower() if category else ""

        requires_sena_plate = cat_name in ("maquinaria y equipos", "muebles y enseres")
        requires_serial = cat_name in ("maquinaria y equipos", "muebles y enseres")
        requires_dimensions = cat_name == "muebles y enseres"

        model = str(data.get("model", "")).strip()
        if not model:
            raise ValidationError({"model": "El modelo es obligatorio."})

        serial = str(data.get("serial", "")).strip()
        if requires_serial and not serial:
            raise ValidationError({"serial": "El número de serie es obligatorio para esta categoría."})
        serial = serial or None

        if serial and ReturnableMaterial.objects.filter(serial__iexact=serial).exists():
            raise ValidationError({"serial": "Ya existe un material devolutivo con este número de serie."})

        sena_plate = data.get("sena_plate")
        if sena_plate:
            sena_plate = str(sena_plate).strip() or None

        if requires_sena_plate and not sena_plate:
            raise ValidationError({"sena_plate": "La placa SENA es obligatoria para esta categoría."})

        if sena_plate and ConsumableMaterial.objects.filter(sena_plate__iexact=sena_plate).exists():
            raise ValidationError({"sena_plate": "Ya existe un material con esta placa SENA."})

        dimensions = data.get("dimensions")
        if requires_dimensions and not dimensions:
            raise ValidationError({"dimensions": "Las dimensiones son obligatorias para esta categoría."})
        dimensions = dimensions or None

        try:
            with transaction.atomic():
                consumable = ConsumableMaterial.objects.create(
                    name=data.get('name', ''),
                    sena_plate=sena_plate,
                    state=data.get('state', 'Disponible'),
                    brand_id=data.get('brand_id') or None,
                    quantity=data.get('quantity') or None,
                    unit_price=data.get('unit_price', 0),
                    total_price=data.get('total_price', 0),
                    description=data.get('description', data.get('name', '')),
                    purchase_date=data.get('purchase_date') or None,
                    location=data.get('location') or None,
                    is_active=True,
                    user=request.user,
                    image=files.get('image', ''),
                )

                rm = ReturnableMaterial.objects.create(
                    consumable=consumable,
                    category_id=category_id,
                    model=model,
                    serial=serial,
                    dimensions=dimensions,
                )

                # Guardar fichas técnicas (hasta 3: technical_sheet_0, _1, _2)
                from .models import TechnicalSheet
                for key in sorted(files.keys()):
                    if key == 'technical_sheet' or key.startswith('technical_sheet_'):
                        TechnicalSheet.objects.create(material=consumable, file=files[key])
        except IntegrityError as exc:
            err_msg = str(exc)
            if "serial" in err_msg:
                raise ValidationError({"serial": "Ya existe un material devolutivo con este número de serie."})
            elif "sena_plate" in err_msg:
                raise ValidationError({"sena_plate": "Ya existe un material con esta placa SENA."})
            raise ValidationError({"detail": "Error de integridad de datos: ya existe un registro con la misma información."})

        serializer = self.get_serializer(rm)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        # Actualiza ambas tablas (ConsumableMaterial + ReturnableMaterial).
        # Solo toca los campos presentes en el request para soportar PATCH parcial.
        partial = kwargs.pop('partial', False)
        rm = self.get_object()
        consumable = rm.consumable
        data = request.data
        files = request.FILES

        category_id = data.get('category_id', rm.category_id)
        if 'category_id' in data:
            self.validate_fixed_category(category_id, rm.category_id)

        category = Category.objects.filter(pk=category_id).first()
        cat_name = category.name.strip().lower() if category else ""

        requires_sena_plate = cat_name in ("maquinaria y equipos", "muebles y enseres")
        requires_serial = cat_name in ("maquinaria y equipos", "muebles y enseres")
        requires_dimensions = cat_name == "muebles y enseres"

        if 'model' in data:
            model = str(data.get('model', '')).strip()
            if not model:
                raise ValidationError({"model": "El modelo es obligatorio."})
            rm.model = model

        if 'serial' in data or ('category_id' in data and requires_serial):
            serial_val = data.get('serial') if 'serial' in data else rm.serial
            serial = str(serial_val or '').strip()
            if requires_serial and not serial:
                raise ValidationError({"serial": "El número de serie es obligatorio para esta categoría."})
            serial = serial or None
            if serial and ReturnableMaterial.objects.filter(serial__iexact=serial).exclude(pk=rm.pk).exists():
                raise ValidationError({"serial": "Ya existe un material devolutivo con este número de serie."})
            rm.serial = serial

        if 'sena_plate' in data or ('category_id' in data and requires_sena_plate):
            sp_val = data.get('sena_plate') if 'sena_plate' in data else consumable.sena_plate
            sena_plate = str(sp_val or '').strip() or None
            if requires_sena_plate and not sena_plate:
                raise ValidationError({"sena_plate": "La placa SENA es obligatoria para esta categoría."})
            if sena_plate and ConsumableMaterial.objects.filter(sena_plate__iexact=sena_plate).exclude(pk=consumable.pk).exists():
                raise ValidationError({"sena_plate": "Ya existe un material con esta placa SENA."})
            consumable.sena_plate = sena_plate

        if 'dimensions' in data or ('category_id' in data and requires_dimensions):
            dim_val = data.get('dimensions') if 'dimensions' in data else rm.dimensions
            dimensions = str(dim_val or '').strip() or None
            if requires_dimensions and not dimensions:
                raise ValidationError({"dimensions": "Las dimensiones son obligatorias para esta categoría."})
            rm.dimensions = dimensions

        # Mapa campo-del-request -> atributo del ConsumableMaterial.
        # Los valores se asignan tal cual; los vacios se normalizan a None.
        consumable_fields = {
            'name': 'name',
            'state': 'state',
            'brand_id': 'brand_id',
            'quantity': 'quantity',
            'unit_price': 'unit_price',
            'total_price': 'total_price',
            'description': 'description',
            'purchase_date': 'purchase_date',
            'location': 'location',
        }
        nullable = {'brand_id', 'quantity', 'purchase_date', 'location'}

        try:
            with transaction.atomic():
                for key, attr in consumable_fields.items():
                    if key in data:
                        value = data.get(key)
                        if key in nullable:
                            value = value or None
                        setattr(consumable, attr, value)

                if 'image' in files:
                    consumable.image = files.get('image')

                consumable.save()

                if 'category_id' in data:
                    rm.category_id = category_id

                # Fichas técnicas nuevas en el PATCH (se agregan al lote existente).
                from .models import TechnicalSheet as TS
                for key in sorted(files.keys()):
                    if key == 'technical_sheet' or key.startswith('technical_sheet_'):
                        TS.objects.create(material=consumable, file=files[key])

                rm.save()
        except IntegrityError as exc:
            err_msg = str(exc)
            if "serial" in err_msg:
                raise ValidationError({"serial": "Ya existe un material devolutivo con este número de serie."})
            elif "sena_plate" in err_msg:
                raise ValidationError({"sena_plate": "Ya existe un material con esta placa SENA."})
            raise ValidationError({"detail": "Error de integridad de datos: ya existe un registro con la misma información."})

        serializer = self.get_serializer(rm)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: eliminar una ficha técnica individual
# ─────────────────────────────────────────────────────────────────────────────

from rest_framework.views import APIView as _APIView
from rest_framework.response import Response as _Resp

class TechnicalSheetDeleteView(_APIView):
    """
    DELETE /api/products/technical-sheets/<pk>/
    Elimina una ficha técnica por su ID.
    Solo accesible para usuarios con permiso edit_returnable.
    """
    def get_permissions(self):
        return [HasPermission("edit_returnable")]

    def delete(self, request, pk):
        from .models import TechnicalSheet
        try:
            sheet = TechnicalSheet.objects.get(pk=pk)
        except TechnicalSheet.DoesNotExist:
            return _Resp({"error": "Ficha técnica no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        sheet.file.delete(save=False)   # borra el archivo del disco
        sheet.delete()
        return _Resp(status=status.HTTP_204_NO_CONTENT)
