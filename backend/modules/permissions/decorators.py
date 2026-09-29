#
# Decoradores para proteger vistas con permisos.
# Se aplican sobre métodos de vista (FBV o métodos de clase).
#

from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from .services import PermissionService


def require_permission(permission_codename):
    """
    Decorador que requiere un permiso específico para acceder a una vista.

    Uso en vistas basadas en función (FBV):
        @require_permission('list_users')
        def mi_vista(request):
            return Response({'data': ...})

    Uso en métodos de ViewSet (CBV):
        class MiViewSet(viewsets.ModelViewSet):
            @require_permission('list_users')
            def list(self, request, *args, **kwargs):
                return super().list(request, *args, **kwargs)

    Args:
        permission_codename: str - Código del permiso requerido

    Returns:
        function - Decorador
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Verificar autenticación
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"error": "Autenticación requerida"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Verificar permiso
            if not PermissionService.has_permission(request.user, permission_codename):
                return Response(
                    {
                        "error": f"Permiso requerido: {permission_codename}",
                        "required_permission": permission_codename,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    # Versión para métodos de clase (debe recibir self)
    def class_decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            # Verificar autenticación
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"error": "Autenticación requerida"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Verificar permiso
            if not PermissionService.has_permission(request.user, permission_codename):
                return Response(
                    {
                        "error": f"Permiso requerido: {permission_codename}",
                        "required_permission": permission_codename,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            return view_func(self, request, *args, **kwargs)

        return wrapper

    # Detectar si es método de clase o función
    return class_decorator


def require_any_permission(*permission_codenames):
    """
    Decorador que requiere AL MENOS UNO de los permisos especificados.

    Uso:
        @require_any_permission('approve_loan', 'is_manager')
        def aprobar_prestamo(request):
            return Response({'status': 'approved'})

    Args:
        *permission_codenames: str - Códigos de permisos (uno o más)

    Returns:
        function - Decorador
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"error": "Autenticación requerida"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            has_any = any(
                PermissionService.has_permission(request.user, perm)
                for perm in permission_codenames
            )

            if not has_any:
                return Response(
                    {
                        "error": f"Se requiere uno de estos permisos: {', '.join(permission_codenames)}",
                        "required_permissions": permission_codenames,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            return view_func(self, request, *args, **kwargs)

        return wrapper

    return decorator


def require_all_permissions(*permission_codenames):
    """
    Decorador que requiere TODOS los permisos especificados.

    Uso:
        @require_all_permissions('edit_loan', 'approve_loan')
        def editar_y_aprobar_prestamo(request):
            return Response({'status': 'approved'})

    Args:
        *permission_codenames: str - Códigos de permisos (uno o más)

    Returns:
        function - Decorador
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"error": "Autenticación requerida"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            has_all = all(
                PermissionService.has_permission(request.user, perm)
                for perm in permission_codenames
            )

            if not has_all:
                return Response(
                    {
                        "error": f"Se requieren todos estos permisos: {', '.join(permission_codenames)}",
                        "required_permissions": permission_codenames,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            return view_func(self, request, *args, **kwargs)

        return wrapper

    return decorator
