#
# Tests para el módulo de permisos.
#

from django.test import TestCase
from django.contrib.auth import get_user_model
from modules.permissions.models import Permission, Group, UserPermission, UserGroup
from modules.permissions.services import PermissionService

User = get_user_model()


class PermissionServiceTestCase(TestCase):
    """Tests para el servicio de permisos"""

    def setUp(self):
        """Crear datos de prueba"""
        # Crear permisos
        self.perm_list_users = Permission.objects.create(
            codename='list_users',
            name='Listar usuarios'
        )
        self.perm_create_users = Permission.objects.create(
            codename='create_user',
            name='Crear usuario'
        )
        self.perm_approve_loan = Permission.objects.create(
            codename='approve_loan',
            name='Aprobar préstamo'
        )

        # Crear grupo
        self.admin_group = Group.objects.create(
            name='Administradores',
            description='Acceso total'
        )
        self.admin_group.permissions.set([
            self.perm_list_users,
            self.perm_create_users,
            self.perm_approve_loan
        ])

        # Crear usuarios
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='secure123',
            is_superuser=True
        )

        self.normal_user = User.objects.create_user(
            email='user@example.com',
            password='secure123'
        )

        self.anon_user = User.objects.create_user(
            email='anon@example.com',
            password='secure123',
            is_active=False
        )

    def test_superuser_has_all_permissions(self):
        """Un superusuario siempre tiene todos los permisos"""
        self.assertTrue(
            PermissionService.has_permission(self.admin_user, 'list_users')
        )
        self.assertTrue(
            PermissionService.has_permission(self.admin_user, 'nonexistent_perm')
        )

    def test_user_without_permission_denied(self):
        """Un usuario sin permiso no puede acceder"""
        self.assertFalse(
            PermissionService.has_permission(self.normal_user, 'list_users')
        )

    def test_user_with_direct_permission_granted(self):
        """Un usuario con permiso directo puede acceder"""
        UserPermission.objects.create(
            user=self.normal_user,
            permission=self.perm_list_users
        )
        self.assertTrue(
            PermissionService.has_permission(self.normal_user, 'list_users')
        )

    def test_user_with_group_permission_granted(self):
        """Un usuario en un grupo con permisos puede acceder"""
        UserGroup.objects.create(
            user=self.normal_user,
            group=self.admin_group
        )
        self.assertTrue(
            PermissionService.has_permission(self.normal_user, 'list_users')
        )
        self.assertTrue(
            PermissionService.has_permission(self.normal_user, 'approve_loan')
        )

    def test_get_user_permissions(self):
        """Obtener todos los permisos de un usuario"""
        UserPermission.objects.create(
            user=self.normal_user,
            permission=self.perm_list_users
        )
        UserGroup.objects.create(
            user=self.normal_user,
            group=self.admin_group
        )

        permissions = PermissionService.get_user_permissions(self.normal_user)
        codes = PermissionService.get_user_permission_codes(self.normal_user)

        # Debería tener permisos directos + permisos por grupo
        self.assertIn('list_users', codes)
        self.assertIn('approve_loan', codes)

    def test_assign_permission_to_user(self):
        """Asignar permiso directo a un usuario"""
        user_perm, created = PermissionService.assign_permission_to_user(
            self.normal_user,
            'create_user',
            reason='Test'
        )
        self.assertTrue(created)
        self.assertTrue(
            PermissionService.has_permission(self.normal_user, 'create_user')
        )

    def test_remove_permission_from_user(self):
        """Remover permiso directo de un usuario"""
        PermissionService.assign_permission_to_user(
            self.normal_user,
            'create_user'
        )
        removed = PermissionService.remove_permission_from_user(
            self.normal_user,
            'create_user'
        )
        self.assertTrue(removed)
        self.assertFalse(
            PermissionService.has_permission(self.normal_user, 'create_user')
        )

    def test_add_user_to_group(self):
        """Agregar usuario a un grupo"""
        user_group, created = PermissionService.add_user_to_group(
            self.normal_user,
            'Administradores'
        )
        self.assertTrue(created)
        self.assertTrue(
            PermissionService.has_permission(self.normal_user, 'list_users')
        )

    def test_remove_user_from_group(self):
        """Remover usuario de un grupo"""
        PermissionService.add_user_to_group(self.normal_user, 'Administradores')
        removed = PermissionService.remove_user_from_group(
            self.normal_user,
            'Administradores'
        )
        self.assertTrue(removed)
        self.assertFalse(
            PermissionService.has_permission(self.normal_user, 'list_users')
        )

    def test_get_user_groups(self):
        """Obtener grupos de un usuario"""
        PermissionService.add_user_to_group(self.normal_user, 'Administradores')
        groups = PermissionService.get_user_groups(self.normal_user)
        self.assertEqual(groups.count(), 1)
        self.assertEqual(groups.first().name, 'Administradores')

    def test_anonymous_user_denied(self):
        """Un usuario anónimo (no autenticado) no tiene permisos"""
        self.assertFalse(
            PermissionService.has_permission(None, 'list_users')
        )

    def test_inactive_user_denied(self):
        """Un usuario inactivo no tiene permisos"""
        self.assertFalse(
            PermissionService.has_permission(self.anon_user, 'list_users')
        )
