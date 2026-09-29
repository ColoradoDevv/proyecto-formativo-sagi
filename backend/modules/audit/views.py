#
# Vistas del módulo audit.
# Solo el superadministrador primigenio puede leer el historial.
#

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import BasePermission

from .models import AuditLog
from .serializers import AuditLogSerializer


class IsPrimaryAdmin(BasePermission):
    """Solo el superadministrador primigenio del sistema puede acceder."""

    message = "Solo el superadministrador primigenio puede acceder al historial."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_primary_admin", False)
        )


class AuditLogFilter(django_filters.FilterSet):
    """
    Filtros para la lista de entradas de auditoría.

    Soporta:
    - ?module=users          → filtro exacto por módulo
    - ?action=CREATE         → filtro exacto por acción
    - ?actor=<id>            → filtro por usuario actor
    - ?date_from=2026-01-01  → entradas desde esa fecha (inclusive)
    - ?date_to=2026-12-31    → entradas hasta esa fecha (inclusive)
    - ?search=texto          → búsqueda libre en actor_name, target_repr, detail
    """

    date_from = django_filters.DateFilter(field_name="timestamp__date", lookup_expr="gte")
    date_to   = django_filters.DateFilter(field_name="timestamp__date", lookup_expr="lte")

    class Meta:
        model  = AuditLog
        fields = ["module", "action", "actor"]


class AuditLogListView(generics.ListAPIView):
    """
    GET /api/audit/
    Lista paginada del historial de auditoría.
    Solo accesible para el superadministrador primigenio (is_primary_admin=True).
    """

    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class   = AuditLogSerializer
    permission_classes = [IsPrimaryAdmin]

    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class  = AuditLogFilter
    search_fields    = ["actor_name", "target_repr", "detail"]
    ordering_fields  = ["timestamp", "module", "action", "actor_name"]
    ordering         = ["-timestamp"]
