# Rutas del modulo productos (CRUD).

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    BrandViewSet,
    CategoryViewSet,
    ConsumableMaterialViewSet,
    InventoryViewSet,
    ReturnableMaterialViewSet,
    TechnicalSheetDeleteView,
    QuotationViewSet,
)

router = DefaultRouter()
router.register(r"brands",      BrandViewSet,              basename="brands")
router.register(r"inventories", InventoryViewSet,           basename="inventories")
router.register(r"categories",  CategoryViewSet,           basename="categories")
router.register(r"consumables", ConsumableMaterialViewSet, basename="consumables")
router.register(r"returnables", ReturnableMaterialViewSet, basename="returnables")
router.register(r"quotations",  QuotationViewSet,          basename="quotations")

urlpatterns = [
    path("technical-sheets/<int:pk>/", TechnicalSheetDeleteView.as_view(), name="technical-sheet-delete"),
    path("", include(router.urls)),
]
