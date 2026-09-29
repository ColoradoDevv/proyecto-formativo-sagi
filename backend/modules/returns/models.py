# Modelo del modulo returns (Retornos de prestamos).

from django.db import models
from modules.loans.models import Loans
from modules.products.models import ConsumableMaterial


class LoanReturn(models.Model):
    # Registro de la devolucion de un prestamo.

    # PK, AI, unico - generado automaticamente por Django
    id = models.AutoField(primary_key=True)

    # FK al prestamo que se esta devolviendo - obligatorio segun diccionario
    loan = models.ForeignKey(
        Loans,
        on_delete=models.RESTRICT,  # No se puede borrar un prestamo si tiene retornos
        null=False
    )

    # FK al material que se devuelve - obligatorio segun diccionario
    material = models.ForeignKey(
        ConsumableMaterial,
        on_delete=models.RESTRICT,  # No se puede borrar material si tiene retornos
        null=False
    )

    # Cantidad sobrante: aplica a materiales de consumo (se reintegra al stock).
    leftover_quantity = models.IntegerField(null=True)

    # Cantidad devuelta: aplica a materiales devolutivos. Si es menor a la
    # prestada, la devolucion queda "Incompleta".
    returned_quantity = models.IntegerField(null=True)

    # Observaciones del receptor de la devolucion - obligatorio segun diccionario
    observations = models.CharField(max_length=255)

    # Condición del material al momento de la devolución.
    # Determina el estado que se le asigna al material tras la devolución:
    #   Bueno        → Disponible  (flujo normal)
    #   Mantenimiento → Mantenimiento  (requiere revisión técnica)
    #   Baja          → Baja           (fuera de servicio permanente)
    CONDITION_CHOICES = [
        ('Bueno',         'Bueno'),
        ('Mantenimiento', 'Mantenimiento'),
        ('Baja',          'Baja'),
    ]
    material_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='Bueno',
        help_text='Estado en que se recibe el material. Determina si pasa a Disponible, Mantenimiento o Baja.',
    )

    # Fecha y hora de devolucion - se llena automaticamente al crear el registro
    return_date = models.DateTimeField(auto_now_add=True)  # CURRENT_TIMESTAMP segun diccionario

    class Meta:
        db_table = 'Retornos_prestamo'

    def __str__(self):
        return f'Retorno {self.id} - Prestamo {self.loan_id} - Material {self.material_id}'