#
# Servicio centralizado de permisos.
# Contiene la lógica para verificar y gestionar permisos de usuarios.
#

from django.core.cache import cache
from django.db.models import Q

from .models import Permission, UserPermission, UserGroup


class PermissionService:
    """
    Servicio centralizado para verificar y gestionar permisos de usuarios.

    Implementa el patrón: Superusuario > Permisos directos > Permisos por grupo
    """

    CACHE_TIMEOUT = 300  # 5 minutos
    CACHE_KEY_PERMISSIONS = "user_permissions_{}"
    CACHE_KEY_PERM_CHECK = "user_has_permission_{}_{}"

    @staticmethod
    def has_permission(user, permission_codename):
        """
        Verifica si un usuario tiene un permiso específico.

        Retorna True si:
        1. El usuario es superusuario (is_superuser=True), O
        2. El usuario tiene el permiso asignado directamente, O
        3. El usuario pertenece a un grupo que tiene el permiso

        Args:
            user: Instancia de User
            permission_codename: str - Código del permiso (ej: 'list_users')

        Returns:
            bool - True si tiene permiso, False en caso contrario
        """
        # Usuario anónimo nunca tiene permisos
        if not user or not user.is_authenticated:
            return False

        # Superusuario siempre tiene todos los permisos
        if user.is_superuser:
            return True

        # Buscar en caché primero
        cache_key = PermissionService.CACHE_KEY_PERM_CHECK.format(
            user.id, permission_codename
        )
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # Verificar en base de datos
        has_perm = PermissionService._check_permission_in_db(user, permission_codename)

        # Guardar en caché
        cache.set(cache_key, has_perm, PermissionService.CACHE_TIMEOUT)

        return has_perm

    @staticmethod
    def _check_permission_in_db(user, permission_codename):
        """
        Verifica permiso en base de datos (sin caché).
        Llamado internamente por has_permission().
        """
        # 1. Verificar permiso directo (asignado directamente al usuario)
        direct_permission_exists = UserPermission.objects.filter(
            user=user, permission__codename=permission_codename
        ).exists()

        if direct_permission_exists:
            return True

        # 2. Verificar permisos por grupo (heredados del grupo)
        group_permission_exists = UserGroup.objects.filter(
            user=user,
            group__group_permissions__permission__codename=permission_codename,
        ).exists()

        return group_permission_exists

    @staticmethod
    def get_user_permissions(user):
        """
        Obtiene todos los permisos de un usuario (directos + heredados por grupo).

        Args:
            user: Instancia de User

        Returns:
            QuerySet de Permission con todos los permisos del usuario
        """
        if not user or not user.is_authenticated:
            return Permission.objects.none()

        # Superusuario tiene todos los permisos
        if user.is_superuser:
            return Permission.objects.all()

        # Buscar en caché
        cache_key = PermissionService.CACHE_KEY_PERMISSIONS.format(user.id)
        cached_permissions = cache.get(cache_key)
        if cached_permissions is not None:
            return cached_permissions

        # Obtener de BD: permisos directos | permisos por grupo, sin duplicados.
        # Usamos el operador | (OR a nivel ORM) en vez de .union() porque SQLite
        # no soporta .distinct() sobre un queryset combinado con .union().
        # El filtro Q equivalente produce un único SELECT con LEFT JOINs que sí
        # admite DISTINCT.
        all_permissions = Permission.objects.filter(
            Q(direct_user_permissions__user=user)
            | Q(group_permissions__group__user_groups__user=user)
        ).distinct()

        # Guardar en caché
        cache.set(cache_key, all_permissions, PermissionService.CACHE_TIMEOUT)

        return all_permissions

    @staticmethod
    def get_user_permission_codes(user):
        """
        Obtiene los códigos de todos los permisos de un usuario.

        Args:
            user: Instancia de User

        Returns:
            list - Lista de strings con los códigos de permiso
        """
        permissions = PermissionService.get_user_permissions(user)
        return list(permissions.values_list("codename", flat=True))

    @staticmethod
    def invalidate_user_cache(user_id):
        """
        Invalida el caché de permisos de un usuario.
        Llamar después de cambiar permisos o grupos de un usuario.

        Args:
            user_id: int - ID del usuario
        """
        cache_key_perms = PermissionService.CACHE_KEY_PERMISSIONS.format(user_id)
        cache.delete(cache_key_perms)

        # Invalidar todos los permisos específicos de este usuario
        # (En producción, mejor usar Redis pattern matching)
        all_permission_codes = Permission.objects.values_list("codename", flat=True)
        for code in all_permission_codes:
            cache_key = PermissionService.CACHE_KEY_PERM_CHECK.format(user_id, code)
            cache.delete(cache_key)

    @staticmethod
    def assign_permission_to_user(user, permission_codename, reason=""):
        """
        Asigna un permiso directamente a un usuario.

        Args:
            user: Instancia de User
            permission_codename: str - Código del permiso
            reason: str - Razón de la asignación (opcional)

        Returns:
            tuple (UserPermission, created: bool)
        """
        permission = Permission.objects.get(codename=permission_codename)
        user_perm, created = UserPermission.objects.get_or_create(
            user=user, permission=permission, defaults={"reason": reason}
        )
        PermissionService.invalidate_user_cache(user.id)
        return user_perm, created

    @staticmethod
    def remove_permission_from_user(user, permission_codename):
        """
        Remueve un permiso de un usuario.

        Args:
            user: Instancia de User
            permission_codename: str - Código del permiso

        Returns:
            bool - True si se removió, False si no existía
        """
        permission = Permission.objects.get(codename=permission_codename)
        deleted_count, _ = UserPermission.objects.filter(
            user=user, permission=permission
        ).delete()
        PermissionService.invalidate_user_cache(user.id)
        return deleted_count > 0

    @staticmethod
    def add_user_to_group(user, group_name):
        """
        Agrega un usuario a un grupo.

        Args:
            user: Instancia de User
            group_name: str - Nombre del grupo

        Returns:
            tuple (UserGroup, created: bool)
        """
        from .models import Group

        group = Group.objects.get(name=group_name)
        user_group, created = UserGroup.objects.get_or_create(user=user, group=group)
        PermissionService.invalidate_user_cache(user.id)
        return user_group, created

    @staticmethod
    def remove_user_from_group(user, group_name):
        """
        Remueve un usuario de un grupo.

        Args:
            user: Instancia de User
            group_name: str - Nombre del grupo

        Returns:
            bool - True si se removió, False si no existía
        """
        from .models import Group

        group = Group.objects.get(name=group_name)
        deleted_count, _ = UserGroup.objects.filter(user=user, group=group).delete()
        PermissionService.invalidate_user_cache(user.id)
        return deleted_count > 0

    @staticmethod
    def get_user_groups(user):
        """
        Obtiene todos los grupos a los que pertenece un usuario.

        Args:
            user: Instancia de User

        Returns:
            QuerySet de Group
        """
        from .models import Group

        return Group.objects.filter(user_groups__user=user)

    @staticmethod
    def permission_exists(permission_codename):
        """
        Verifica si un permiso existe en el sistema.

        Args:
            permission_codename: str

        Returns:
            bool
        """
        return Permission.objects.filter(codename=permission_codename).exists()
