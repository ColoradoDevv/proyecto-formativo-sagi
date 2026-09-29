# Serializers del modulo returns.
# Convierte modelos a JSON y valida las reglas de la devolucion.

from rest_framework import serializers
from .models import LoanReturn


class LoanReturnSerializer(serializers.ModelSerializer):
    # Serializer para registrar la devolucion / sobrante de un prestamo.

    class Meta:
        model = LoanReturn
        fields = '__all__'
        extra_kwargs = {
            # La cantidad sobrante solo aplica a materiales de consumo.
            'leftover_quantity': {'required': False, 'allow_null': True},
            # La cantidad devuelta solo aplica a materiales devolutivos.
            'returned_quantity': {'required': False, 'allow_null': True},
            # El material se deriva del prestamo; no se envia desde el cliente.
            'material': {'required': False},
            # Observaciones opcionales (ej. estado en que se devuelve).
            'observations': {'required': False, 'allow_blank': True},
            # Condición del material: opcional, default Bueno.
            'material_condition': {'required': False},
        }

    def validate(self, data):
        loan = data.get('loan')

        # 1. El prestamo debe existir y no estar cerrado (Finalizado/Incompleto).
        if loan is None:
            raise serializers.ValidationError({'loan': 'Debe indicar el préstamo a devolver.'})

        if loan.state in ('Finalizado', 'Incompleto'):
            raise serializers.ValidationError({'loan': 'Este préstamo ya fue devuelto.'})

        # 2. Cantidad sobrante (consumo): 0 ≤ sobrante ≤ prestado.
        leftover = data.get('leftover_quantity')
        if leftover is not None:
            if leftover < 0:
                raise serializers.ValidationError(
                    {'leftover_quantity': 'La cantidad sobrante no puede ser negativa.'}
                )
            if leftover > loan.amount_lent:
                raise serializers.ValidationError(
                    {'leftover_quantity': 'La cantidad sobrante no puede superar la cantidad prestada.'}
                )

        # 3. Cantidad devuelta (devolutivo): 1 ≤ devuelta ≤ prestado.
        returned = data.get('returned_quantity')
        if returned is not None:
            if returned < 1:
                raise serializers.ValidationError(
                    {'returned_quantity': 'La cantidad devuelta debe ser al menos 1.'}
                )
            if returned > loan.amount_lent:
                raise serializers.ValidationError(
                    {'returned_quantity': 'La cantidad devuelta no puede superar la cantidad prestada.'}
                )

        return data
