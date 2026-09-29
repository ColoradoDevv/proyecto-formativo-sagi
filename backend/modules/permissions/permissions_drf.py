#
# Permission Classes para Django REST Framework.
# Se usan en lugar de decoradores para mayor integración con DRF.
#

from rest_framework.permissions import BasePermission
from .services import PermissionService


class HasPermission(BasePermission):
    """
    Permission class configurable que verifica un permiso específico.

    Uso como factory (recomendado):
        class MiViewSet(viewsets.ModelViewSet):
            def get_permissions(self):
                if self.action == 'list':
                    return [HasPermission('list_users')]
                elif self.action == 'create':
                    return [HasPermission('create_user')]
                return [IsSuperUser()]

    Uso con atributo (alternativo):
        class MiViewSet(viewsets.ModelViewSet):
            permission_classes = [HasPermission]
            required_permission = 'list_users'
    """

    def __init__(self, codename=None):
        """
        Inicializa la clase de permiso con un código específico.

        Args:
            codename: str - Código del permiso (ej: 'list_users'). 
                      Si es None, se busca en view.required_permission
        """
        self.codename = codename
        super().__init__()

    message = "No tienes permiso para realizar esta acción"

    def has_permission(self, request, view):
        """
        Verifica si el usuario tiene el permiso requerido.

        Orden de búsqueda del permiso:
        1. self.codename (pasado al constructor)
        2. view.required_permission (atributo de la vista)
        3. Si no hay permiso definido, permite acceso
        """
        # Superusuarios siempre pasan
        if request.user and request.user.is_superuser:
            return True

        # Obtener permiso requerido
        required_permission = self.codename
        if required_permission is None:
            required_permission = getattr(view, "required_permission", None)

        # Si no hay permiso definido, permitir acceso
        if required_permission is None:
            return True

        # Verificar permiso
        if PermissionService.has_permission(request.user, required_permission):
            return True

        self.message = f"Permiso requerido: {required_permission}"
        return False


class HasAnyPermission(BasePermission):
    """
    Permission class que requiere AL MENOS UNO de los permisos especificados.

    Uso:
        class MiViewSet(viewsets.ModelViewSet):
            permission_classes = [HasAnyPermission]
            required_permissions = ['approve_loan', 'is_manager']
    """

    message = "No tienes ninguno de los permisos requeridos"

    def has_permission(self, request, view):
        """
        Verifica si el usuario tiene al menos uno de los permisos.
        """
        required_permissions = getattr(view, "required_permissions", [])

        if not required_permissions:
            return True

        has_any = any(
            PermissionService.has_permission(request.user, perm)
            for perm in required_permissions
        )

        if has_any:
            return True

        self.message = f"Se requiere uno de estos permisos: {', '.join(required_permissions)}"
        return False


class HasAllPermissions(BasePermission):
    """
    Permission class que requiere TODOS los permisos especificados.

    Uso:
        class MiViewSet(viewsets.ModelViewSet):
            permission_classes = [HasAllPermissions]
            required_permissions = ['edit_loan', 'approve_loan']
    """

    message = "No tienes todos los permisos requeridos"

    def has_permission(self, request, view):
        """
        Verifica si el usuario tiene todos los permisos.
        """
        required_permissions = getattr(view, "required_permissions", [])

        if not required_permissions:
            return True

        has_all = all(
            PermissionService.has_permission(request.user, perm)
            for perm in required_permissions
        )

        if has_all:
            return True

        self.message = f"Se requieren todos estos permisos: {', '.join(required_permissions)}"
        return False


class IsSuperUser(BasePermission):
    """
    Permission class que solo permite superusuarios.
    """

    message = "Solo superusuarios pueden acceder a esta acción"

    def has_permission(self, request, view):
        return request.user and request.user.is_superuser


class IsAuthenticated(BasePermission):
    """
    Permission class que solo permite usuarios autenticados.
    """

    message = "Autenticación requerida"

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


# ---------------------------------------------------------------------------
# Helper — no es una permission class, se usa directamente en las vistas.
# ---------------------------------------------------------------------------

def is_primary_admin(user) -> bool:
    """
    Devuelve True si el usuario es el superadministrador primigenio del sistema.
    Se accede al campo a través del atributo del modelo para evitar imports
    circulares: el campo vive en users.models pero permissions.views necesita
    usarlo sin importar dicho módulo de forma directa (ya lo importa normalmente).
    """
    return bool(getattr(user, "is_primary_admin", False))
