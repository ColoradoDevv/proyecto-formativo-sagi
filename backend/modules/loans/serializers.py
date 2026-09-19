# Serializers del modulo loans.
# Convierte modelos a JSON y valida lo que llega.

from rest_framework import serializers
from .models import Loans
from django.db.models import Sum



class LoanSerializer(serializers.ModelSerializer):
    # Serializer para préstamos.

    usuario_responsable = serializers.SerializerMethodField()
    usuario_receptor    = serializers.SerializerMethodField()
    material            = serializers.SerializerMethodField()
    material_type       = serializers.SerializerMethodField()
    is_active           = serializers.SerializerMethodField()

    # ── Trazabilidad de firma (solo lectura) ──────────────────────────────
    firma_responsable = serializers.SerializerMethodField()
    firma_receptor    = serializers.SerializerMethodField()

    class Meta:
        model = Loans
        fields = [
            'id_loan',
            'batch_id',
            'id_responsable_user',
            'id_receptor_user',
            'id_material',
            'amount_lent',
            'apprentice_group',
            'justification_use',
            'return_date',
            'loan_date',
            'state',
            'usuario_responsable',
            'usuario_receptor',
            'material',
            'material_type',
            'is_active',
            # firma
            'firma_responsable',
            'firma_receptor',
            'loan_type'
        ]
        extra_kwargs = {
            # return_date no tiene auto_now_add, el frontend debe enviarlo
            'return_date': {'required': True},
            # state es gestionado internamente; no se acepta desde el cliente
            'state': {'read_only': True},
            # loan_date se rellena automáticamente (auto_now_add)
            'loan_date': {'read_only': True},
            # El flujo de receptor no registrado solo existe en el camino de
            # borrador (LoanDraftCreateView) — este serializer es del CRUD
            # directo/legado, que sigue exigiendo un usuario receptor real.
            'id_receptor_user': {'required': True},
        }

    # ── Campos computados ─────────────────────────────────────────────────

    def get_usuario_responsable(self, obj):
        return f"{obj.id_responsable_user.first_name} {obj.id_responsable_user.last_name}"

    def get_usuario_receptor(self, obj):
        return obj.receptor_display_name

    def get_material(self, obj):
        return obj.id_material.name

    def get_material_type(self, obj):
        # "devolutivo" si el material tiene su registro ReturnableMaterial; si no, "consumo".
        return "devolutivo" if hasattr(obj.id_material, "returnablematerial") else "consumo"

    def get_is_active(self, obj):
        # Un préstamo está activo para devolución solo en estado 'Activo'.
        return obj.state == 'Activo'

    def get_firma_responsable(self, obj):
        if obj.signed_by_responsable_id is None:
            return None
        return {
            "usuario": f"{obj.signed_by_responsable.first_name} {obj.signed_by_responsable.last_name}",
            "fecha":   obj.signed_at_responsable.isoformat() if obj.signed_at_responsable else None,
            "ip":      obj.signed_ip_responsable,
            "user_agent": obj.signed_ua_responsable,
        }

    def get_firma_receptor(self, obj):
        if obj.signed_by_receptor_id is None:
            return None
        return {
            "usuario": f"{obj.signed_by_receptor.first_name} {obj.signed_by_receptor.last_name}",
            "fecha":   obj.signed_at_receptor.isoformat() if obj.signed_at_receptor else None,
            "ip":      obj.signed_ip_receptor,
            "user_agent": obj.signed_ua_receptor,
        }

    # ── Validación de stock ───────────────────────────────────────────────

    def validate(self, attrs):
        material    = attrs.get('id_material') or getattr(self.instance, 'id_material', None)
        amount_lent = attrs.get('amount_lent', getattr(self.instance, 'amount_lent', None))

        # Validar que el material esté activo antes de crear o editar un préstamo
        if material is not None and not material.is_active:
            raise serializers.ValidationError({
                'id_material': 'Este material está deshabilitado y no puede prestarse.'
            })

        if material is not None and amount_lent is not None:
            if material.quantity is not None:
                # Contar solo préstamos Activos O Pendientes (ambos retienen stock)
                active_loans = Loans.objects.filter(
                    id_material=material,
                    state__in=['Activo', 'Pendiente'],
                )

                # Al editar, no contar el propio préstamo contra sí mismo
                if self.instance is not None:
                    active_loans = active_loans.exclude(pk=self.instance.pk)

                already_lent = active_loans.aggregate(total=Sum('amount_lent'))['total'] or 0
                available    = material.quantity - already_lent

                if amount_lent > available:
                    raise serializers.ValidationError({
                        'amount_lent': (
                            f'Solo quedan {available} unidades disponibles de "{material.name}" '
                            f'(stock total: {material.quantity}, ya prestadas: {already_lent}).'
                        )
                    })

        return attrs
