#
# Esquema tolerante para /docs/ (coreapi).
#
# django-filter >= 2 eliminó `get_schema_fields` de DjangoFilterBackend,
# pero el AutoSchema de coreapi (DRF) lo sigue invocando y /docs/ revienta
# con AttributeError en cuanto una vista declara filter_backends.
# Este shim omite los backends sin ese método en vez de romper todo.
#

from rest_framework.schemas.coreapi import AutoSchema


class TolerantAutoSchema(AutoSchema):
    def get_filter_fields(self, path, method):
        filter_backends = getattr(self.view, "filter_backends", None)
        if not filter_backends:
            return []
        fields = []
        for backend_class in filter_backends:
            get_schema_fields = getattr(backend_class(), "get_schema_fields", None)
            if callable(get_schema_fields):
                fields += get_schema_fields(self.view)
        return fields
