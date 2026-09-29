#
# URLs del módulo de permisos.
#

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PermissionViewSet, GroupViewSet, UserPermissionView, UserGroupView

# Router para ViewSets
router = DefaultRouter()
router.register(r"permissions", PermissionViewSet, basename="permission")
router.register(r"groups", GroupViewSet, basename="group")

# URLs para gestión de permisos de usuario (no es ViewSet porque es más simple)
urlpatterns = [
    path("", include(router.urls)),
    # Gestión de permisos de usuarios específicos
    path("users/<int:user_id>/permissions/", UserPermissionView.as_view(), name="user-permissions"),
    # Gestión de grupos de usuarios específicos
    path("users/<int:user_id>/groups/", UserGroupView.as_view(), name="user-groups"),
]
