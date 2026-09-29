# URLs del modulo loans.

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    LoanViewSet,
    LoanSignView,
    LoanSignRequestOTPView,
    LoanDraftCreateView,
    LoanDraftSignRequestOTPView,
    LoanDraftSignView,
    LoanDraftStatusView,
    LoanBatchListView,
)

router = DefaultRouter()
router.register(r'', LoanViewSet, basename='loans')

urlpatterns = [
    # ── Flujo de firma sobre préstamos ya existentes (legado) ─────────────
    path('sign/request-otp/', LoanSignRequestOTPView.as_view(), name='loan-sign-request-otp'),
    path('sign/',             LoanSignView.as_view(),           name='loan-sign'),

    # ── Flujo draft: crear primero, firmar después, Loans nace al final ───
    path('draft/',                              LoanDraftCreateView.as_view(),           name='loan-draft-create'),
    path('draft/sign/request-otp/',             LoanDraftSignRequestOTPView.as_view(),   name='loan-draft-sign-request-otp'),
    path('draft/sign/',                         LoanDraftSignView.as_view(),             name='loan-draft-sign'),
    path('draft/<str:batch_id>/status/',        LoanDraftStatusView.as_view(),           name='loan-draft-status'),

    # ── Listado agrupado por lote ──────────────────────────────────────────
    path('batches/',                            LoanBatchListView.as_view(),             name='loan-batch-list'),
] + router.urls
