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


class GroupDestroyBlockedTestCase(TestCase):
    """Fase 0: el DELETE de grupos está bloqueado (evita borrar
    membresías en silencio por el CASCADE)."""

    def setUp(self):
        from rest_framework.test import APIClient

        self.creator = User.objects.create_user(
            email='sadmin_fase0@example.com',
            password='secure123',
            is_superuser=True,
        )
        self.group = Group.objects.create(name='Fase0Grupo')
        self.member = User.objects.create_user(
            email='miembro_fase0@example.com',
            password='secure123',
        )
        PermissionService.add_user_to_group(self.member, 'Fase0Grupo')
        self.client = APIClient()
        self.client.force_authenticate(user=self.creator)

    def test_destroy_group_is_forbidden(self):
        """DELETE /api/permissions/groups/<id>/ responde 403."""
        response = self.client.delete(f"/api/permissions/groups/{self.group.id}/")
        self.assertEqual(response.status_code, 403)

    def test_destroy_group_keeps_memberships(self):
        """Tras el intento, el grupo y sus membresías siguen intactos."""
        self.client.delete(f"/api/permissions/groups/{self.group.id}/")
        self.assertTrue(Group.objects.filter(pk=self.group.pk).exists())
        self.assertEqual(
            UserGroup.objects.filter(group=self.group).count(), 1
        )


class PermissionWeightTestCase(TestCase):
    """Fase 1: tiers de peso y autoridad calculada (solo métrica)."""

    def test_weight_tiers(self):
        from modules.permissions.authority import permission_weight_for

        self.assertEqual(permission_weight_for("view_user"), 10)
        self.assertEqual(permission_weight_for("list_users"), 10)
        self.assertEqual(permission_weight_for("export_users"), 20)
        self.assertEqual(permission_weight_for("create_user"), 30)
        self.assertEqual(permission_weight_for("disable_user"), 50)
        self.assertEqual(permission_weight_for("delete_user"), 100)
        self.assertEqual(permission_weight_for("manage_role_permissions"), 150)
        self.assertEqual(permission_weight_for("approve_elevation"), 150)

    def test_authority_for_group_sums_weights(self):
        p_view = Permission.objects.create(codename="fase1_view_x", name="Ver X")
        p_del = Permission.objects.create(codename="fase1_delete_x", name="Borrar X")
        p_view.weight = 10
        p_view.save(update_fields=["weight"])
        p_del.weight = 100
        p_del.save(update_fields=["weight"])
        group = Group.objects.create(name="Fase1Grupo")
        group.permissions.add(p_view, p_del)
        self.assertEqual(PermissionService.authority_for_group(group), 110)

    def test_authority_empty_group_is_zero(self):
        group = Group.objects.create(name="Fase1Vacio")
        self.assertEqual(PermissionService.authority_for_group(group), 0)


class HierarchyVisibilityTestCase(TestCase):
    """Fase 3: cada rol lista su mismo nivel o inferiores (nunca encima)."""

    def setUp(self):
        from rest_framework.test import APIClient

        def make_user(email, group_name, **extra):
            user = User.objects.create_user(
                email=email, password="x-Segura-123",
                first_name="Fase3", last_name="Test", **extra
            )
            if group_name:
                PermissionService.add_user_to_group(user, group_name)
            return user

        self.sadmin = make_user("fase3_sadmin@x.co", "SADMIN")
        self.admin = make_user("fase3_admin@x.co", "ADMIN")
        self.inst = make_user("fase3_inst@x.co", "INST")
        self.inv = make_user("fase3_inv@x.co", "INV")
        self.client = APIClient()

    def list_as(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, 200)
        return {u["email"] for u in response.data["results"]} if isinstance(response.data, dict) else {u["email"] for u in response.data}

    def test_admin_no_ve_sadmin(self):
        seen = self.list_as(self.admin)
        self.assertNotIn("fase3_sadmin@x.co", seen)
        self.assertIn("fase3_admin@x.co", seen)
        self.assertIn("fase3_inst@x.co", seen)
        self.assertIn("fase3_inv@x.co", seen)

    def test_inst_solo_su_nivel_e_inferior(self):
        seen = self.list_as(self.inst)
        self.assertEqual(seen, {"fase3_inst@x.co", "fase3_inv@x.co"})

    def test_inv_solo_su_nivel(self):
        seen = self.list_as(self.inv)
        self.assertEqual(seen, {"fase3_inv@x.co"})

    def test_sadmin_ve_todo_menos_primario(self):
        seen = self.list_as(self.sadmin)
        self.assertEqual(
            seen,
            {"fase3_sadmin@x.co", "fase3_admin@x.co", "fase3_inst@x.co", "fase3_inv@x.co"},
        )

    def test_detalle_superior_da_404(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/users/{self.sadmin.pk}/")
        self.assertEqual(response.status_code, 404)
        response = self.client.get(f"/api/users/{self.inst.pk}/")
        self.assertEqual(response.status_code, 200)


class GroupHierarchyFieldsTestCase(TestCase):
    """Fase 2: level/is_system/template/ceiling y migración de los 4 grupos."""

    def test_new_group_defaults_to_bottom(self):
        group = Group.objects.create(name="Fase2Nuevo")
        self.assertEqual(group.level, 900)
        self.assertFalse(group.is_system)
        self.assertIsNone(group.template_role)
        self.assertIsNone(group.authority_ceiling)

    def test_system_groups_have_levels(self):
        expected = {
            "SADMIN": (100, True, None),
            "ADMIN": (200, True, 2600),
            "INST": (300, True, 1000),
            "INV": (400, True, 500),
        }
        for name, (level, is_system, ceiling) in expected.items():
            group = Group.objects.get(name=name)
            self.assertEqual(group.level, level, name)
            self.assertEqual(group.is_system, is_system, name)
            self.assertEqual(group.authority_ceiling, ceiling, name)

    def test_hierarchy_fields_are_read_only_via_api(self):
        """PATCH con level/is_system/ceiling se ignora (anti mass assignment)."""
        from rest_framework.test import APIClient

        creator = User.objects.create_user(
            email="sadmin_fase2@example.com",
            password="secure123",
            is_superuser=True,
        )
        group = Group.objects.create(name="Fase2Editable")
        client = APIClient()
        client.force_authenticate(user=creator)
        response = client.patch(
            f"/api/permissions/groups/{group.pk}/",
            {"name": "Fase2Editado", "level": 100, "is_system": True, "authority_ceiling": 9999},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.name, "Fase2Editado")
        self.assertEqual(group.level, 900)
        self.assertFalse(group.is_system)
        self.assertIsNone(group.authority_ceiling)
