# Rutas basicas del modulo home.

from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/dashboard/summary/", views.DashboardSummaryView.as_view(), name="dashboard-summary"),
]
