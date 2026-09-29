# Vistas del modulo returns.
# Registra la devolucion de un prestamo y aplica las reglas de negocio:
# finaliza el prestamo, actualiza el estado/stock del material y deja
# trazabilidad en la tabla de retornos.

from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response

from .models import LoanReturn
from .serializers import LoanReturnSerializer
from modules.permissions.permissions_drf import HasPermission, IsSuperUser
from modules.audit.mixins import AuditMixin


class LoanReturnViewSet(AuditMixin, viewsets.ModelViewSet):
    # CRUD de retornos de prestamos.
    queryset = LoanReturn.objects.select_related('loan', 'material').all().order_by('id')
    serializer_class = LoanReturnSerializer

    def get_permissions(self):
        if self.action == "create":
            return [HasPermission("create_return")]
        # list/retrieve/update/destroy — solo superusuarios por defecto
        return [IsSuperUser()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        loan = serializer.validated_data['loan']

        # Bloquear devolución si el préstamo aún no está Activo
        if loan.state == 'Pendiente':
            return Response(
                {
                    'error': (
                        "Este préstamo aún está pendiente de firma por ambas partes. "
                        "No se puede registrar una devolución hasta que esté Activo."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        material = loan.id_material  # el material se deriva del prestamo
        leftover  = serializer.validated_data.get('leftover_quantity')
        returned  = serializer.validated_data.get('returned_quantity')
        condition = serializer.validated_data.get('material_condition', 'Bueno')

        # Mapa de condición → estado del material
        # Bueno        → Disponible      (flujo normal)
        # Mantenimiento → Mantenimiento  (necesita revisión técnica)
        # Baja          → Baja           (fuera de servicio permanente)
        CONDITION_STATE_MAP = {
            'Bueno':         'Disponible',
            'Mantenimiento': 'Mantenimiento',
            'Baja':          'Baja',
        }
        new_material_state = CONDITION_STATE_MAP.get(condition, 'Disponible')

        # Es devolutivo si el material tiene su registro ReturnableMaterial.
        is_returnable = hasattr(material, 'returnablematerial')

        with transaction.atomic():
            # 1. Registrar la devolucion (trazabilidad).
            loan_return = LoanReturn.objects.create(
                loan=loan,
                material=material,
                leftover_quantity=leftover,
                returned_quantity=returned,
                observations=serializer.validated_data.get('observations', ''),
                material_condition=condition,
            )

            # 2. Actualizar el material y decidir el estado final del préstamo.
            if is_returnable:
                # Devolutivo: estado del material según condición declarada.
                # Si la condición es Baja, el material sale permanentemente
                # del inventario activo, independiente de la cantidad devuelta.
                material.state = new_material_state
                if returned is not None and returned < loan.amount_lent:
                    new_loan_state = 'Incompleto'
                else:
                    new_loan_state = 'Finalizado'
            else:
                # Consumo: lo prestado se considera consumido, salvo el
                # sobrante. Si el sobrante está en buen estado, se reintegra
                # al stock disponible; si no, también se descuenta (queda
                # inutilizable). No se toca material.state: a diferencia de
                # un devolutivo (una unidad física real), un consumible es
                # una fila de stock agregado — su Estado lo controla el
                # admin desde crear/editar y activar/desactivar, no una
                # devolución individual.
                material.quantity = max(0, (material.quantity or 0) - loan.amount_lent)
                if leftover and condition == 'Bueno':
                    material.quantity += leftover
                new_loan_state = 'Finalizado'

            material.save()

            # 3. Cerrar el prestamo con el estado calculado.
            loan.state = new_loan_state
            loan.save(update_fields=['state'])

        out = self.get_serializer(loan_return)
        return Response(out.data, status=status.HTTP_201_CREATED)
