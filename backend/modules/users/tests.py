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
