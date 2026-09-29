# Rutas del CRUD de usuarios.

from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("forgot-password/", views.ForgetPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", views.ResetPasswordView.as_view(), name="reset-password"),
    path("me/", views.MyProfileView.as_view(), name="my-profile"),
    path("me/change-password/request/", views.RequestPasswordChangeOTPView.as_view(), name="change-password-request"),
    path("me/change-password/confirm/", views.ConfirmPasswordChangeView.as_view(), name="change-password-confirm"),
    path("me/change-password/first-login/", views.FirstLoginPasswordChangeView.as_view(), name="change-password-first-login"),
    path("me/consent/", views.DataConsentView.as_view(), name="my-consent"),

    path("", views.UserListCreateView.as_view(), name="users-list"),
    path("trash/", views.UserTrashListView.as_view(), name="users-trash"),
    path("<int:pk>/", views.UserDetailView.as_view(), name="users-detail"),
    path("<int:pk>/restore/", views.UserRestoreView.as_view(), name="users-restore"),
    path("<int:pk>/resend-credentials/", views.ResendCredentialsView.as_view(), name="users-resend-credentials"),

    # Ruta /roles/ eliminada en P11: el campo role fue removido de User (migración 0003).
    # El modelo Role se conserva por datos históricos pero ya no tiene FK activa.
    # path("roles/", views.UserRolesListView.as_view(), name="users-roles-list"),
    path("document-types/", views.UserDocumentTypesListView.as_view(), name="users-document-types-list"),
]
