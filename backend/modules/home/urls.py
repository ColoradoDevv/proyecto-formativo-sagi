# Rutas basicas del modulo home.

from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("healthz/", views.HealthCheckView.as_view(), name="healthz"),
    path("api/dashboard/summary/", views.DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("api/support/email/", views.SupportEmailView.as_view(), name="support-email"),
]
