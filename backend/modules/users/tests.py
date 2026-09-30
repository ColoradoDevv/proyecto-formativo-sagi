from django.test import TestCase

from .models import User
from .serializers import UserSerializer
from modules.permissions.models import Group, UserGroup


class UserSerializerTests(TestCase):
    def test_duplicate_document_number_has_specific_error(self):
        User.objects.create_user(
            email="existing@example.com",
            password="test-password",
            first_name="Usuario",
            last_name="Existente",
            document_number="123456789",
        )

        serializer = UserSerializer(data={
            "email": "new@example.com",
            "first_name": "Usuario",
            "last_name": "Nuevo",
            "document_number": "123456789",
        })

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors["document_number"][0],
            "El número de documento ya está registrado para otro usuario.",
        )

    def test_disabling_admin_requires_reason(self):
        admin = User.objects.create_user(
            email="admin@example.com",
            password="test-password",
            first_name="Usuario",
            last_name="Administrador",
        )
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        UserGroup.objects.create(user=admin, group=admin_group)

        serializer = UserSerializer(
            admin,
            data={"is_active": False},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("deactivation_reason", serializer.errors)

    def test_disabling_admin_stores_valid_reason(self):
        admin = User.objects.create_user(
            email="admin-valid@example.com",
            password="test-password",
            first_name="Usuario",
            last_name="Administrador",
        )
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        UserGroup.objects.create(user=admin, group=admin_group)

        serializer = UserSerializer(
            admin,
            data={
                "is_active": False,
                "deactivation_reason": "Ausencia prolongada con autorización previa.",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()
        self.assertFalse(updated_user.is_active)
        self.assertEqual(
            updated_user.deactivation_reason,
            "Ausencia prolongada con autorización previa.",
        )

    def test_disabling_regular_user_requires_reason(self):
        user = User.objects.create_user(
            email="regular@example.com",
            password="test-password",
            first_name="Usuario",
            last_name="Regular",
        )

        serializer = UserSerializer(
            user,
            data={"is_active": False},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("deactivation_reason", serializer.errors)

# Create your tests here.


class MFATestCase(TestCase):
    """Fase 7: TOTP en login (puerta, inscripción, verificación, respaldo)."""

    @classmethod
    def setUpClass(cls):
        import os

        from cryptography.fernet import Fernet

        os.environ["MFA_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
        super().setUpClass()

    def setUp(self):
        from rest_framework.test import APIClient

        self.creator = User.objects.create_user(
            email="mfa_admin@x.co", password="x-Segura-123",
            first_name="M", last_name="F", is_superuser=True,
        )
        self.plain = User.objects.create_user(
            email="mfa_plain@x.co", password="x-Segura-123",
            first_name="M", last_name="F",
        )
        self.client = APIClient()

    def login(self, email, password="x-Segura-123"):
        return self.client.post(
            "/api/users/login/", {"email": email, "password": password}, format="json"
        )

    def enroll_and_confirm(self, mfa_token):
        import pyotp

        from modules.users.mfa import decrypt_secret, mfa_device_for

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {mfa_token}")
        res = self.client.post("/api/users/me/mfa/enroll/", {}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("qr_png", res.data)
        user = User.objects.get(email="mfa_admin@x.co")
        secret = decrypt_secret(mfa_device_for(user))
        code = pyotp.TOTP(secret).now()
        res = self.client.post("/api/users/me/mfa/confirm/", {"code": code}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["recovery_codes"]), 10)
        return res.data

    def test_superuser_pide_mfa(self):
        res = self.login("mfa_admin@x.co")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["mfa_required"])
        self.assertTrue(res.data["enroll_required"])
        self.assertNotIn("token", res.data)

    def test_usuario_comun_tambien_pide_mfa(self):
        # Política: 2FA para todos los roles, sin excepciones por nivel.
        res = self.login("mfa_plain@x.co")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["mfa_required"])
        self.assertTrue(res.data["enroll_required"])
        self.assertNotIn("token", res.data)

    def test_temp_token_sin_acceso_api(self):
        mfa_token = self.login("mfa_admin@x.co").data["mfa_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {mfa_token}")
        res = self.client.get("/api/users/me/")
        self.assertEqual(res.status_code, 401)

    def test_flujo_completo_y_verify(self):
        data = self.enroll_and_confirm(self.login("mfa_admin@x.co").data["mfa_token"])
        session_token = data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session_token}")
        res = self.client.get("/api/users/me/")
        self.assertEqual(res.status_code, 200)
        # Segundo login exige código (ya inscrito).
        mfa_token = self.login("mfa_admin@x.co").data["mfa_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {mfa_token}")
        res = self.client.post("/api/users/me/mfa/verify/", {"code": "000000"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_recovery_un_solo_uso(self):
        import pyotp

        from modules.users.mfa import decrypt_secret, mfa_device_for

        data = self.enroll_and_confirm(self.login("mfa_admin@x.co").data["mfa_token"])
        code = data["recovery_codes"][0]
        mfa_token = self.login("mfa_admin@x.co").data["mfa_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {mfa_token}")
        res = self.client.post(
            "/api/users/me/mfa/verify/", {"recovery_code": code}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("token", res.data)
        mfa_token = self.login("mfa_admin@x.co").data["mfa_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {mfa_token}")
        res = self.client.post(
            "/api/users/me/mfa/verify/", {"recovery_code": code}, format="json"
        )
        self.assertEqual(res.status_code, 401)

    def test_status_y_disable_bloqueado(self):
        # El 2FA es obligatorio: desactivar responde 403 y sigue activo.
        data = self.enroll_and_confirm(self.login("mfa_admin@x.co").data["mfa_token"])
        session = data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session}")
        res = self.client.get("/api/users/me/mfa/status/")
        self.assertTrue(res.data["enabled"])
        self.assertTrue(res.data["required"])
        res = self.client.post(
            "/api/users/me/mfa/disable/", {"password": "x-Segura-123"}, format="json"
        )
        self.assertEqual(res.status_code, 403)
        res = self.client.get("/api/users/me/mfa/status/")
        self.assertTrue(res.data["enabled"])

    def test_reset_por_consola(self):
        from django.core.management import call_command

        self.enroll_and_confirm(self.login("mfa_admin@x.co").data["mfa_token"])
        call_command("mfa_reset", "mfa_admin@x.co")
        from modules.users.mfa import mfa_device_for

        user = User.objects.get(email="mfa_admin@x.co")
        self.assertIsNone(mfa_device_for(user))
