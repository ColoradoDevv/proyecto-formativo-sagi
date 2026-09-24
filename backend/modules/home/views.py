# Vista sencilla para la ruta raiz (ping rapido).

from django.core.validators import EmailValidator
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response

from modules.permissions.permissions_drf import IsSuperUser
from .models import SiteSetting


def index(request):
    # Devuelve un texto simple para confirmar que el servidor responde.
    return HttpResponse("Hello, world. You're at the polls index.")


class DashboardSummaryView(APIView):
    """GET /api/dashboard/summary/ — contadores para las tarjetas del inicio.

    Una sola petición en vez de 4 listados completos (el dashboard solo
    necesita los totales). Cada contador se incluye únicamente si el
    usuario tiene permiso para ver ese módulo.
    """

    def get(self, request):
        from modules.permissions.services import PermissionService
        from modules.users.models import User
        from modules.products.models import ConsumableMaterial, ReturnableMaterial
        from modules.loans.models import Loans
        from django.db.models import Q

        codes = set(PermissionService.get_user_permission_codes(request.user))
        data = {}

        if codes & {"list_users", "view_user"}:
            data["users"] = User.objects.count()
        if codes & {"list_consumable_materials", "view_consumable_material", "view_consumable"}:
            data["consumables"] = ConsumableMaterial.objects.count()
        if codes & {"list_returnable_materials", "view_returnable_material", "view_returnable"}:
            data["returnables"] = ReturnableMaterial.objects.count()
        if codes & {"list_loans", "view_loan"}:
            loans = Loans.objects.all()
            if not request.user.is_superuser:
                from modules.permissions.models import UserGroup
                is_admin = UserGroup.objects.filter(
                    user=request.user, group__name__iexact="admin"
                ).exists()
                if not is_admin:
                    loans = loans.filter(
                        Q(id_responsable_user=request.user) | Q(id_receptor_user=request.user)
                    )
            data["loans"] = loans.count()

        return Response(data)


class SupportEmailView(APIView):
    """GET /api/support/email/ — correo de soporte vigente (público, para
    mostrar "Contactar soporte" incluso en el login sin sesión).

    PUT /api/support/email/ — cambia el correo para todos (solo superusuario).
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsSuperUser()]

    def get(self, request):
        return Response({"email": SiteSetting.get_support_email()})

    def put(self, request):
        email = str(request.data.get("email") or "").strip()
        try:
            EmailValidator()(email)
        except Exception:
            return Response(
                {"error": "Debe ingresar un correo electrónico válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        SiteSetting.objects.update_or_create(
            key=SiteSetting.SUPPORT_EMAIL_KEY,
            defaults={"value": email},
        )
        return Response({"email": email})
