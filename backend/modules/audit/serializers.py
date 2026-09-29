#
# Serializers del módulo audit.
#

from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    # Campos legibles en lugar de los valores crudos de los choices.
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    # Timestamp formateado HH:MM DD/MM/AAAA (requerimiento del producto).
    timestamp_formatted = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "module",
            "module_display",
            "action",
            "action_display",
            "target_id",
            "target_repr",
            "detail",
            "ip_address",
            "timestamp",
            "timestamp_formatted",
        ]
        read_only_fields = fields

    def get_timestamp_formatted(self, obj) -> str:
        """Devuelve el timestamp en formato HH:MM DD/MM/AAAA (hora local UTC)."""
        return obj.timestamp.strftime("%H:%M %d/%m/%Y")
