from django.test import TestCase
from rest_framework.test import APIClient

from modules.products.models import Brand, ConsumableMaterial
from modules.users.models import User
from .models import Loans


class LoanBatchCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="test-password",
            first_name="Admin",
            last_name="Sistema",
        )
        self.receiver = User.objects.create_user(
            email="receiver@example.com",
            password="test-password",
            first_name="Usuario",
            last_name="Receptor",
        )
        brand = Brand.objects.create(name="Marca de prueba")
        self.first_material = ConsumableMaterial.objects.create(
            user=self.admin,
            brand=brand,
            name="Material uno",
            quantity=10,
            unit_price=100,
            total_price=1000,
            state="Disponible",
            description="Material para prueba de préstamo",
            purchase_date="2026-01-01",
        )
        self.second_material = ConsumableMaterial.objects.create(
            user=self.admin,
            brand=brand,
            name="Material dos",
            quantity=1,
            unit_price=100,
            total_price=100,
            state="Disponible",
            description="Material para prueba de préstamo",
            purchase_date="2026-01-01",
        )
        self.client.force_authenticate(user=self.admin)

    def loan_payload(self, material_ids, amount=1):
        return {
            "id_responsable_user": self.admin.id,
            "id_receptor_user": self.receiver.id,
            "id_material": material_ids,
            "amount_lent": {str(material_id): amount for material_id in material_ids},
            "apprentice_group": "123456",
            "justification_use": "Préstamo para una actividad de formación.",
            "return_date": "2026-12-31",
        }

    def test_creates_one_loan_for_each_selected_material(self):
        payload = self.loan_payload([self.first_material.id, self.second_material.id])
        payload["amount_lent"] = {
            str(self.first_material.id): 3,
            str(self.second_material.id): 1,
        }
        response = self.client.post(
            "/api/loans/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(Loans.objects.count(), 2)
        self.assertEqual(
            list(Loans.objects.order_by("id_material").values_list("amount_lent", flat=True)),
            [3, 1],
        )

    def test_rolls_back_batch_when_one_material_cannot_be_lent(self):
        response = self.client.post(
            "/api/loans/",
            self.loan_payload([self.first_material.id, self.second_material.id], amount=2),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Loans.objects.count(), 0)
