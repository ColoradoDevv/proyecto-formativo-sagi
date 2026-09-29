#
# Permisos globales del módulo users.
#

from rest_framework.permissions import BasePermission


class NotBlockedByPasswordChange(BasePermission):
    """
    Bloquea el acceso a la API cuando el usuario debe cambiar su contraseña.

    Las vistas que deben seguir accesibles deben declarar:
        allow_during_password_change = True
    """

    message = "Debes cambiar tu contraseña antes de continuar."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return True

        if not getattr(user, "must_change_password", False):
            return True

        return getattr(view, "allow_during_password_change", False)
