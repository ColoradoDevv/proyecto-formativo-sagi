#
# Vistas para administración de permisos y grupos.
#

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from modules.users.models import User
from .models import Permission, Group, UserPermission, UserGroup, SYSTEM_GROUP_NAME
from .serializers import (
    PermissionSerializer,
    GroupListSerializer,
    GroupDetailSerializer,
    UserPermissionSerializer,
    UserGroupSerializer,
    AssignPermissionSerializer,
    AssignGroupSerializer,
)
from .services import PermissionService
from .permissions_drf import IsSuperUser, HasPermission, is_primary_admin
from modules.audit.utils import log as audit_log
from modules.audit.models import AuditLog


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para visualizar permisos del sistema.
    Solo superusuarios pueden ver todos los permisos.
    """

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["codename", "name"]
    search_fields = ["codename", "name", "description"]
    ordering_fields = ["codename", "created_at"]
    ordering = ["codename"]

    def get_queryset(self):
        """Solo superusuarios ven todos los permisos"""
        if self.request.user.is_superuser:
            return Permission.objects.all()
        # Usuarios normales solo ven permisos que tienen asignados
        return PermissionService.get_user_permissions(self.request.user)

    @action(detail=False, methods=["get"])
    def my_permissions(self, request):
        """Endpoint que retorna los permisos del usuario actual"""
        permissions = PermissionService.get_user_permissions(request.user)
        serializer = self.get_serializer(permissions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_permission_codes(self, request):
        """Endpoint que retorna solo los códigos de permiso del usuario actual"""
        codes = PermissionService.get_user_permission_codes(request.user)
        return Response({"permissions": codes})


class GroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet para administrar grupos y sus permisos.
    Cualquier usuario autenticado puede listar/ver grupos (p. ej. para
    asignarlos al crear un usuario). Solo superusuarios pueden
    crear/modificar/eliminar grupos.
    """

    queryset = Group.objects.all()

    def get_queryset(self):
        # SADMIN es un grupo interno: se administra únicamente desde backend.
        return Group.objects.exclude(name__iexact=SYSTEM_GROUP_NAME)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsSuperUser()]

    def get_serializer_class(self):
        """Usa serializers diferentes según la acción"""
        if self.action == "list":
            return GroupListSerializer
        return GroupDetailSerializer

    @action(detail=True, methods=["post"])
    def assign_permission(self, request, pk=None):
        """
        Asigna un permiso a un grupo.
        POST /groups/{id}/assign_permission/
        Body: {"permission_codename": "list_users"}
        """
        group = self.get_object()
        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            permission = Permission.objects.get(
                codename=serializer.validated_data["permission_codename"]
            )
        except Permission.DoesNotExist:
            return Response(
                {"error": "Permiso no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Agregar permiso al grupo
        group.permissions.add(permission)

        # Invalidar caché de usuarios en este grupo (igual que
        # remove_permission: si no, el permiso nuevo tarda hasta 5 min
        # en reflejarse por PermissionService.CACHE_TIMEOUT).
        for user_group in group.user_groups.all():
            PermissionService.invalidate_user_cache(user_group.user.id)

        return Response(
            {
                "message": f"Permiso '{permission.codename}' asignado al grupo '{group.name}'",
                "permission": PermissionSerializer(permission).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def remove_permission(self, request, pk=None):
        """
        Remueve un permiso de un grupo.
        POST /groups/{id}/remove_permission/
        Body: {"permission_codename": "list_users"}
        """
        group = self.get_object()
        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            permission = Permission.objects.get(
                codename=serializer.validated_data["permission_codename"]
            )
        except Permission.DoesNotExist:
            return Response(
                {"error": "Permiso no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Remover permiso del grupo
        group.permissions.remove(permission)

        # Invalidar caché de usuarios en este grupo
        for user_group in group.user_groups.all():
            PermissionService.invalidate_user_cache(user_group.user.id)

        return Response(
            {
                "message": f"Permiso '{permission.codename}' removido del grupo '{group.name}'",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["patch"])
    def toggle_active(self, request, pk=None):
        """
        Activa o desactiva un grupo.
        PATCH /groups/{id}/toggle_active/
        Body: {"is_active": true/false}
        
        No permite desactivar:
        - El grupo "Administrador"
        - Grupos que tienen usuarios activos asignados
        """
        group = self.get_object()
        
        # Protección: no permitir desactivar grupos reservados.
        if group.name in ("Administrador", SYSTEM_GROUP_NAME):
            return Response(
                {"error": "El grupo 'Administrador' no puede ser desactivado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Obtener el valor deseado
        is_active = request.data.get("is_active")
        if is_active is None:
            return Response(
                {"error": "El campo 'is_active' es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Si se intenta desactivar, validar que no tenga usuarios activos
        if not is_active and group.is_active:
            active_users_count = group.user_groups.filter(user__is_active=True).count()
            if active_users_count > 0:
                return Response(
                    {
                        "error": f"No se puede desactivar el grupo '{group.name}' porque tiene {active_users_count} usuario(s) activo(s) asignado(s).",
                        "active_users_count": active_users_count,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        # Actualizar el estado
        group.is_active = is_active
        group.save()
        
        return Response(
            {
                "message": f"Grupo '{group.name}' {'activado' if is_active else 'desactivado'} exitosamente.",
                "is_active": group.is_active,
            },
            status=status.HTTP_200_OK,
        )


class UserPermissionView(generics.GenericAPIView):
    """
    Vista para gestionar permisos de usuarios específicos.
    Solo superusuarios pueden modificar.
    """

    permission_classes = [IsAuthenticated, IsSuperUser]
    serializer_class = UserPermissionSerializer

    def get_user(self, user_id):
        """Obtiene un usuario y lanza error si no existe"""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Response(
                {"error": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, user_id):
        """Obtiene todos los permisos de un usuario"""
        user = self.get_user(user_id)
        permissions = PermissionService.get_user_permissions(user)
        serializer = PermissionSerializer(permissions, many=True)
        return Response(serializer.data)

    def post(self, request, user_id):
        """Asigna un permiso a un usuario"""
        user = self.get_user(user_id)
        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            permission = Permission.objects.get(
                codename=serializer.validated_data["permission_codename"]
            )
        except Permission.DoesNotExist:
            return Response(
                {"error": "Permiso no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_perm, created = UserPermission.objects.get_or_create(
            user=user,
            permission=permission,
            defaults={"reason": serializer.validated_data.get("reason", "")},
        )

        PermissionService.invalidate_user_cache(user.id)

        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_PERMISSIONS,
            action=AuditLog.ACTION_ASSIGN_PERM,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            detail=f"Permiso asignado: {permission.codename}",
            request=request,
        )

        return Response(
            {
                "message": f"Permiso '{permission.codename}' asignado a {user.email}",
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        """Remueve un permiso de un usuario"""
        user = self.get_user(user_id)

        # Protección: el admin primigenio no puede perder permisos directos.
        if is_primary_admin(user):
            return Response(
                {"error": "No se pueden quitar permisos al superadministrador primigenio del sistema."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            permission = Permission.objects.get(
                codename=serializer.validated_data["permission_codename"]
            )
        except Permission.DoesNotExist:
            return Response(
                {"error": "Permiso no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        deleted, _ = UserPermission.objects.filter(
            user=user, permission=permission
        ).delete()

        PermissionService.invalidate_user_cache(user.id)

        if deleted:
            audit_log(
                actor=request.user,
                module=AuditLog.MODULE_PERMISSIONS,
                action=AuditLog.ACTION_REMOVE_PERM,
                target_id=user.pk,
                target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
                detail=f"Permiso removido: {permission.codename}",
                request=request,
            )
            return Response(
                {
                    "message": f"Permiso '{permission.codename}' removido de {user.email}"
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"error": "Permiso no asignado al usuario"},
                status=status.HTTP_404_NOT_FOUND,
            )


class UserGroupView(generics.GenericAPIView):
    """
    Vista para gestionar membresía de usuarios en grupos.
    Usa el mismo par view_user/edit_user que UserDetailView, ya que
    asignar el grupo de un usuario es parte de editarlo.
    """

    serializer_class = UserGroupSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [HasPermission("view_user")]
        return [HasPermission("edit_user")]

    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Response(
                {"error": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, user_id):
        """Obtiene todos los grupos de un usuario"""
        user = self.get_user(user_id)
        groups = PermissionService.get_user_groups(user).exclude(name__iexact=SYSTEM_GROUP_NAME)
        serializer = GroupListSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request, user_id):
        """Agrega un usuario a un grupo"""
        user = self.get_user(user_id)
        serializer = AssignGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            group = Group.objects.get(name=serializer.validated_data["group_name"])
        except Group.DoesNotExist:
            return Response(
                {"error": "Grupo no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        if group.name.upper() == SYSTEM_GROUP_NAME:
            return Response(
                {"error": "El grupo solicitado es interno del sistema."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validar que el grupo esté activo
        if not group.is_active:
            return Response(
                {"error": f"No se puede asignar usuarios al grupo '{group.name}' porque está desactivado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_group, created = UserGroup.objects.get_or_create(user=user, group=group)

        PermissionService.invalidate_user_cache(user.id)

        audit_log(
            actor=request.user,
            module=AuditLog.MODULE_PERMISSIONS,
            action=AuditLog.ACTION_ASSIGN_GROUP,
            target_id=user.pk,
            target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
            detail=f"Grupo asignado: {group.name}",
            request=request,
        )

        return Response(
            {
                "message": f"{user.email} agregado al grupo '{group.name}'",
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        """Remueve un usuario de un grupo"""
        user = self.get_user(user_id)

        # Protección: el admin primigenio no puede ser removido de ningún grupo.
        if is_primary_admin(user):
            return Response(
                {"error": "No se puede quitar al superadministrador primigenio de ningún grupo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            group = Group.objects.get(name=serializer.validated_data["group_name"])
        except Group.DoesNotExist:
            return Response(
                {"error": "Grupo no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if group.name.upper() == SYSTEM_GROUP_NAME:
            return Response(
                {"error": "El grupo solicitado es interno del sistema."},
                status=status.HTTP_403_FORBIDDEN,
            )

        deleted, _ = UserGroup.objects.filter(user=user, group=group).delete()

        PermissionService.invalidate_user_cache(user.id)

        if deleted:
            audit_log(
                actor=request.user,
                module=AuditLog.MODULE_PERMISSIONS,
                action=AuditLog.ACTION_REMOVE_GROUP,
                target_id=user.pk,
                target_repr=f"{user.first_name} {user.last_name} <{user.email}>",
                detail=f"Grupo removido: {group.name}",
                request=request,
            )
            return Response(
                {"message": f"{user.email} removido del grupo '{group.name}'"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"error": "Usuario no pertenece a este grupo"},
                status=status.HTTP_404_NOT_FOUND,
            )
