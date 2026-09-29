#
# AuditMixin — se añade a cualquier ViewSet o APIView para que las señales
# de auditoría puedan acceder al request sin que se les pase explícitamente.
#
# Uso:
#   class MiViewSet(AuditMixin, viewsets.ModelViewSet):
#       ...
#

from .signals import set_current_request, clear_current_request


class AuditMixin:
    """
    Mixin que registra el request en el thread-local antes de cada
    llamada a las vistas, y lo limpia al terminar.

    Funciona tanto en ViewSet (dispatch) como en APIView.
    """

    def initialize_request(self, request, *args, **kwargs):
        req = super().initialize_request(request, *args, **kwargs)
        # En este punto el request de DRF aún no tiene .user resuelto;
        # lo guardamos de todas formas porque perform_* llega después.
        return req

    def initial(self, request, *args, **kwargs):
        """Se ejecuta después de la autenticación → request.user ya está listo."""
        set_current_request(request)
        super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        clear_current_request()
        return super().finalize_response(request, response, *args, **kwargs)
