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


class HardRulesTestCase(TestCase):
    """Fase 4: reglas duras (rango, no amplificación, inmutables, soft delete)."""

    def setUp(self):
        from rest_framework.test import APIClient

        def make_user(email, group_name=None, **extra):
            user = User.objects.create_user(
                email=email, password="x-Segura-123",
                first_name="Fase4", last_name="Test", **extra
            )
            if group_name:
                PermissionService.add_user_to_group(user, group_name)
            return user

        self.primary = make_user("fase4_prim@x.co", None, is_superuser=True)
        self.primary.is_primary_admin = True
        self.primary.save(update_fields=["is_primary_admin"])
        self.sadmin = make_user("fase4_sadmin@x.co", "SADMIN")
        self.admin = make_user("fase4_admin@x.co", "ADMIN")
        self.inst = make_user("fase4_inst@x.co", "INST")
        self.inv = make_user("fase4_inv@x.co", "INV")
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def group_id(self, name):
        return Group.objects.get(name=name).pk

    # ── Asignación de grupos: primario sí puede dar SADMIN ──
    def test_primary_asigna_sadmin(self):
        self.as_user(self.primary)
        response = self.client.post(
            f"/api/permissions/users/{self.inv.pk}/groups/", {"group_name": "SADMIN"}, format="json"
        )
        self.assertEqual(response.status_code, 201)

    def test_admin_no_asigna_sadmin(self):
        self.as_user(self.admin)
        response = self.client.post(
            f"/api/permissions/users/{self.inv.pk}/groups/", {"group_name": "SADMIN"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_si_asigna_inv(self):
        self.as_user(self.admin)
        response = self.client.post(
            f"/api/permissions/users/{self.inst.pk}/groups/", {"group_name": "INV"}, format="json"
        )
        self.assertIn(response.status_code, (200, 201))

    # ── Acciones sobre usuarios: mismo nivel o inferior ──
    def test_admin_no_edita_sadmin(self):
        # Ni siquiera lo ve (Fase 3): el detalle responde 404.
        self.as_user(self.admin)
        response = self.client.patch(
            f"/api/users/{self.sadmin.pk}/", {"first_name": "X"}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_si_edita_inst(self):
        self.as_user(self.admin)
        response = self.client.patch(
            f"/api/users/{self.inst.pk}/", {"first_name": "InstEdit"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    # ── Roles de sistema inmutables (todos, incluido primario) ──
    def test_sistema_inmutable_hasta_primario(self):
        self.as_user(self.primary)
        response = self.client.patch(
            f"/api/permissions/groups/{self.group_id('ADMIN')}/",
            {"description": "cambio"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_grupo_normal_si_se_edita(self):
        self.as_user(self.primary)
        gid = Group.objects.create(name="Fase4Edit", level=500).pk
        response = self.client.patch(
            f"/api/permissions/groups/{gid}/", {"description": "cambio"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    # ── Soft delete ──
    def test_delete_grupo_con_usuarios_403(self):
        self.as_user(self.primary)
        response = self.client.delete(f"/api/permissions/groups/{self.group_id('INV')}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Group.objects.filter(name="INV", is_active=True).exists())

    def test_delete_grupo_vacio_soft(self):
        self.as_user(self.primary)
        gid = Group.objects.create(name="Fase4Borrar", level=500).pk
        response = self.client.delete(f"/api/permissions/groups/{gid}/")
        self.assertEqual(response.status_code, 200)
        group = Group.objects.get(pk=gid)
        self.assertFalse(group.is_active)

    # ── No amplificación ──
    def test_no_amplificacion(self):
        from modules.permissions.ranking import can_grant_permission

        self.assertFalse(can_grant_permission(self.inst, "delete_user"))
        self.assertTrue(can_grant_permission(self.primary, "delete_user"))

    # ── Clasificador N1/N2/N3 ──
    def test_clasificador(self):
        from modules.permissions.ranking import classify_role_change

        level, _ = classify_role_change(self.admin, 500, ["view_user", "list_users"])
        self.assertEqual(level, "N1")
        level, _ = classify_role_change(self.admin, 500, ["view_user", "disable_user"])
        self.assertEqual(level, "N2")
        level, _ = classify_role_change(self.admin, 500, ["manage_role_permissions"])
        self.assertEqual(level, "N3")

    # ── NFKC contra homoglifos ──
    def test_nombre_homoglifo_rechazado(self):
        self.as_user(self.primary)
        response = self.client.post(
            "/api/permissions/groups/",
            {"name": "ＡDMIN", "description": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class PermissionScopeTestCase(TestCase):
    """Fase 6: alcance SELF/ALL en asignaciones y su aplicación."""

    def setUp(self):
        from rest_framework.test import APIClient

        def make_user(email, group_name=None, **extra):
            user = User.objects.create_user(
                email=email, password="x-Segura-123",
                first_name="Fase6", last_name="Test", **extra
            )
            if group_name:
                PermissionService.add_user_to_group(user, group_name)
            return user

        self.sadmin = make_user("fase6_sadmin@x.co", "SADMIN")
        self.admin = make_user("fase6_admin@x.co", "ADMIN")
        self.inst = make_user("fase6_inst@x.co", "INST")
        self.inv = make_user("fase6_inv@x.co", "INV")
        self.client = APIClient()

    def scope_of_group(self, group_name, codename):
        from modules.permissions.models import GroupPermission

        return GroupPermission.objects.get(
            group__name=group_name, permission__codename=codename
        ).scope

    def test_backfill_scope(self):
        """Migración 0024: SADMIN/ADMIN → ALL; INST/INV → SELF en objeto."""
        self.assertEqual(self.scope_of_group("SADMIN", "view_loan"), "ALL")
        self.assertEqual(self.scope_of_group("ADMIN", "view_loan"), "ALL")
        self.assertEqual(self.scope_of_group("INST", "view_loan"), "SELF")
        self.assertEqual(self.scope_of_group("INV", "view_loan"), "SELF")
        self.assertEqual(self.scope_of_group("INST", "view_brand"), "ALL")

    def test_effective_scope(self):
        from modules.permissions.ranking import effective_scope

        boss = User.objects.create_superuser(
            email="fase6_boss@x.co", password="x-Segura-123",
            first_name="F", last_name="T",
        )
        self.assertEqual(effective_scope(boss, "view_loan"), "ALL")
        self.assertEqual(effective_scope(self.inst, "view_brand"), "ALL")
        self.assertEqual(effective_scope(self.inst, "view_loan"), "SELF")
        self.assertEqual(effective_scope(self.admin, "view_loan"), "ALL")

    def test_all_wins(self):
        """Con una asignación ALL entre varias SELF, gana ALL."""
        from modules.permissions.models import Group, GroupPermission, Permission
        from modules.permissions.ranking import effective_scope

        group = Group.objects.create(name="Fase6Mixto", level=500)
        perm = Permission.objects.get(codename="view_loan")
        GroupPermission.objects.create(group=group, permission=perm, scope="ALL")
        PermissionService.add_user_to_group(self.inv, "Fase6Mixto")
        self.assertEqual(effective_scope(self.inv, "view_loan"), "ALL")

    def test_loans_scoping_preserved(self):
        """ADMIN ve todos; INST solo los propios (comportamiento anterior)."""
        from modules.loans.models import Loans
        from modules.products.models import Brand, Category, ConsumableMaterial

        brand = Brand.objects.create(name="Fase6Marca")
        category = Category.objects.create(name="Fase6Cat")
        material = ConsumableMaterial.objects.create(
            brand=brand, category=category, name="Fase6Mat",
            quantity=10, unit_price=100, total_price=1000, state="Disponible",
            description="d", purchase_date="2026-01-01",
        )
        Loans.objects.create(
            id_responsable_user=self.admin, id_receptor_user=self.sadmin,
            id_material=material, amount_lent=1,
            apprentice_group="123", justification_use="Prueba de alcance.",
        )
        Loans.objects.create(
            id_responsable_user=self.admin, id_receptor_user=self.inst,
            id_material=material, amount_lent=1,
            apprentice_group="123", justification_use="Prueba de alcance.",
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/loans/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["results"] if isinstance(res.data, dict) else res.data), 2)
        self.client.force_authenticate(user=self.inst)
        res = self.client.get("/api/loans/")
        self.assertEqual(res.status_code, 200)
        data = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(data), 1)

    def test_task_assignment_scoping(self):
        """Con SELF, lo ajeno es invisible (lista y detalle 404)."""
        import datetime
        from modules.tasks.models import TaskAssignment, TaskDefinition

        group = Group.objects.create(name="Fase6Tasks", level=500)
        perm_codes = ["view_task_assignment"]
        from modules.permissions.models import Permission as Perm

        for code in perm_codes:
            group.permissions.add(Perm.objects.get(codename=code))
        viewer = User.objects.create_user(
            email="fase6_viewer@x.co", password="x-Segura-123",
            first_name="F", last_name="T",
        )
        PermissionService.add_user_to_group(viewer, "Fase6Tasks")
        other = User.objects.create_user(
            email="fase6_other@x.co", password="x-Segura-123",
            first_name="F", last_name="T",
        )
        definition = TaskDefinition.objects.create(name="Fase6Tarea", description="d")
        mine = TaskAssignment.objects.create(
            task=definition, scope="user", user=viewer, state="Pendiente",
            start_date=datetime.date(2026, 1, 1), end_date=datetime.date(2026, 12, 31),
        )
        alien = TaskAssignment.objects.create(
            task=definition, scope="user", user=other, state="Pendiente",
            start_date=datetime.date(2026, 1, 1), end_date=datetime.date(2026, 12, 31),
        )
        self.client.force_authenticate(user=viewer)
        res = self.client.get("/api/tasks/assignments/")
        self.assertEqual(res.status_code, 200)
        data = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual([a["id"] for a in data], [mine.id])
        res = self.client.get(f"/api/tasks/assignments/{alien.id}/")
        self.assertEqual(res.status_code, 404)


class ElevationWorkflowTestCase(TestCase):
    """Fase 5a: borrador → pendiente → aprobada/rechazada → activa."""

    def setUp(self):
        from rest_framework.test import APIClient

        def make_user(email, group_name=None, password="x-Segura-123", **extra):
            user = User.objects.create_user(
                email=email, password=password,
                first_name="Fase5", last_name="Test", **extra
            )
            if group_name:
                PermissionService.add_user_to_group(user, group_name)
            return user

        self.primary = make_user("fase5_prim@x.co", None, is_superuser=True)
        self.primary.is_primary_admin = True
        self.primary.save(update_fields=["is_primary_admin"])
        self.sadmin = make_user("fase5_sadmin@x.co", "SADMIN")
        self.sadmin2 = make_user("fase5_sadmin2@x.co", "SADMIN")
        self.admin = make_user("fase5_admin@x.co", "ADMIN")
        self.client = APIClient()
        self.base = "/api/permissions/roles/requests/"

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def draft(self, user, action="CREATE_ROLE", group=None, payload=None, reason="prueba"):
        self.as_user(user)
        body = {"action": action, "payload": payload or {}, "reason": reason}
        if group:
            body["group"] = group.pk
        return self.client.post(self.base, body, format="json")

    def submit(self, solicitud_id):
        return self.client.post(f"{self.base}{solicitud_id}/submit/", {}, format="json")

    def test_flujo_completo_crear_rol(self):
        """ADMIN pide rol N1 con plantilla INV → SADMIN aprueba → ACTIVA y con permisos."""
        res = self.draft(
            self.admin,
            payload={"name": "Fase5N1", "description": "d", "level": 500, "template_id": Group.objects.get(name="INV").pk},
        )
        self.assertEqual(res.status_code, 201)
        sid = res.data["id"]
        res = self.submit(sid)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "PENDIENTE")
        self.assertEqual(res.data["security_level"], "N1")
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/approve/",
            {"password": "x-Segura-123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "ACTIVA")
        group = Group.objects.get(name="Fase5N1")
        self.assertEqual(group.level, 500)
        self.assertEqual(
            group.permissions.count(), Group.objects.get(name="INV").permissions.count()
        )

    def test_no_autoaprobacion(self):
        res = self.draft(self.sadmin, payload={"name": "Fase5Auto", "level": 500})
        sid = res.data["id"]
        self.submit(sid)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 403)

    def test_par_no_aprueba_n3(self):
        """Rol nivel SADMIN con críticos → N3: otro SADMIN (par) ni siquiera
        lo ve en su bandeja (404); solo el Primigenio lo ve y decide."""
        res = self.draft(
            self.sadmin,
            payload={"name": "Fase5N3", "level": 100, "perm_codenames": ["manage_role_permissions"]},
        )
        sid = res.data["id"]
        res = self.submit(sid)
        self.assertEqual(res.data["security_level"], "N3")
        self.as_user(self.sadmin2)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 404)
        res = self.client.get(f"{self.base}{sid}/", format="json")
        self.assertEqual(res.status_code, 404)

    def test_primigenio_aprueba_n3(self):
        res = self.draft(
            self.sadmin,
            payload={"name": "Fase5N3b", "level": 100, "perm_codenames": ["manage_role_permissions"]},
        )
        sid = res.data["id"]
        self.submit(sid)
        self.as_user(self.primary)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "ACTIVA")

    def test_step_up_incorrecto(self):
        res = self.draft(self.admin, payload={"name": "Fase5Step", "level": 500})
        sid = res.data["id"]
        self.submit(sid)
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "clave-mala"}, format="json"
        )
        self.assertEqual(res.status_code, 403)

    def test_rechazo(self):
        res = self.draft(self.admin, payload={"name": "Fase5Rech", "level": 500})
        sid = res.data["id"]
        self.submit(sid)
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/reject/",
            {"password": "x-Segura-123", "decision_reason": "No justificado."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "RECHAZADA")
        self.assertFalse(Group.objects.filter(name="Fase5Rech").exists())

    def test_expirada_no_se_aprueba(self):
        from django.utils import timezone
        from datetime import timedelta
        from modules.permissions.models import SolicitudCambioRol

        res = self.draft(self.admin, payload={"name": "Fase5Exp", "level": 500})
        sid = res.data["id"]
        self.submit(sid)
        SolicitudCambioRol.objects.filter(pk=sid).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_tamper_invalida(self):
        """Si el rol cambia tras enviar, aprobar se invalida."""
        from modules.permissions.models import GroupPermission, Permission, SolicitudCambioRol

        target = Group.objects.create(name="Fase5Tamper", level=500)
        res = self.draft(
            self.admin, action="UPDATE_ROLE_PERMS", group=target, payload={"add": [], "remove": []}
        )
        sid = res.data["id"]
        self.submit(sid)
        perm = Permission.objects.get(codename="view_user")
        GroupPermission.objects.create(group=target, permission=perm)
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            SolicitudCambioRol.objects.get(pk=sid).status, "CANCELADA"
        )

    def test_recortes_solo_quitan(self):
        res = self.draft(
            self.admin, payload={"name": "Fase5Rec", "level": 500, "perm_codenames": ["view_user", "list_users"]}
        )
        sid = res.data["id"]
        self.submit(sid)
        self.as_user(self.sadmin)
        res = self.client.post(
            f"{self.base}{sid}/approve/",
            {"password": "x-Segura-123", "perm_codenames": ["view_user", "delete_user"]},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        res = self.client.post(
            f"{self.base}{sid}/approve/",
            {"password": "x-Segura-123", "perm_codenames": ["view_user"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        group = Group.objects.get(name="Fase5Rec")
        self.assertEqual(
            set(group.permissions.values_list("codename", flat=True)), {"view_user"}
        )

    def test_limite_pendientes(self):
        for i in range(5):
            res = self.draft(self.admin, payload={"name": f"Fase5Lim{i}", "level": 500})
            self.submit(res.data["id"])
        res = self.draft(self.admin, payload={"name": "Fase5LimX", "level": 500})
        res = self.submit(res.data["id"])
        self.assertEqual(res.status_code, 400)

    def test_notifica_al_enviar_y_decidir(self):
        """Fase 5b: al enviar avisa a elegibles; al decidir avisa al solicitante."""
        from django.core import mail

        res = self.draft(self.admin, payload={"name": "Fase5Mail", "level": 500})
        sid = res.data["id"]
        mail.outbox = []
        self.submit(sid)
        destinatarios = sorted({m.to[0] for m in mail.outbox})
        self.assertIn("fase5_sadmin@x.co", destinatarios)
        self.as_user(self.sadmin)
        mail.outbox = []
        self.client.post(
            f"{self.base}{sid}/approve/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["fase5_admin@x.co"])


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
        # Nivel SADMIN para pasar la regla de rango (Fase 4).
        PermissionService.add_user_to_group(creator, "SADMIN")
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
