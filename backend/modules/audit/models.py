#
# Modelo de auditoría del sistema.
# Registra toda acción relevante de mutación de datos.
#

from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """
    Entrada de la bitácora del sistema.

    Cada fila representa una acción realizada por un usuario autenticado
    (o por el sistema cuando no hay sesión activa, p. ej. tareas programadas).

    Diseño de campos:
    - actor: quién hizo la acción (NULL si fue el sistema).
    - module: módulo del sistema afectado (users, products, loans, returns…).
    - action: verbo estandarizado de la acción (CREATE, UPDATE, DELETE, etc.).
    - target_id: PK del objeto afectado (puede ser null para acciones globales).
    - target_repr: descripción legible del objeto en el momento del evento.
    - detail: texto libre con contexto adicional (campos cambiados, motivos, etc.).
    - ip_address: IP del cliente que originó la solicitud.
    - timestamp: momento exacto del evento (UTC, auto-generado).
    """

    # ── Catálogos de módulos y acciones ──────────────────────────────────
    MODULE_USERS       = "users"
    MODULE_CONSUMABLES = "consumables"
    MODULE_RETURNABLES = "returnables"
    MODULE_BRANDS      = "brands"
    MODULE_LOANS       = "loans"
    MODULE_RETURNS     = "returns"
    MODULE_TASKS       = "tasks"
    MODULE_AUTH        = "auth"
    MODULE_PERMISSIONS = "permissions"

    MODULE_CHOICES = [
        (MODULE_USERS,       "Usuarios"),
        (MODULE_CONSUMABLES, "Materiales Consumibles"),
        (MODULE_RETURNABLES, "Materiales Devolutivos"),
        (MODULE_BRANDS,      "Marcas"),
        (MODULE_LOANS,       "Préstamos"),
        (MODULE_RETURNS,     "Devoluciones"),
        (MODULE_TASKS,       "Tareas"),
        (MODULE_AUTH,        "Autenticación"),
        (MODULE_PERMISSIONS, "Permisos / Grupos"),
    ]

    ACTION_CREATE           = "CREATE"
    ACTION_UPDATE           = "UPDATE"
    ACTION_DELETE           = "DELETE"
    ACTION_TOGGLE_ACTIVE    = "TOGGLE_ACTIVE"
    ACTION_RESTORE          = "RESTORE"
    ACTION_LOGIN            = "LOGIN"
    ACTION_LOGOUT           = "LOGOUT"
    ACTION_PASSWORD_CHANGE  = "PASSWORD_CHANGE"
    ACTION_PASSWORD_RESET   = "PASSWORD_RESET"
    ACTION_ASSIGN_GROUP     = "ASSIGN_GROUP"
    ACTION_REMOVE_GROUP     = "REMOVE_GROUP"
    ACTION_ASSIGN_PERM      = "ASSIGN_PERM"
    ACTION_REMOVE_PERM      = "REMOVE_PERM"
    ACTION_SIGN_LOAN        = "SIGN_LOAN"

    ACTION_CHOICES = [
        (ACTION_CREATE,          "Creación"),
        (ACTION_UPDATE,          "Modificación"),
        (ACTION_DELETE,          "Eliminación"),
        (ACTION_TOGGLE_ACTIVE,   "Activar / Desactivar"),
        (ACTION_RESTORE,         "Restauración"),
        (ACTION_LOGIN,           "Inicio de sesión"),
        (ACTION_LOGOUT,          "Cierre de sesión"),
        (ACTION_PASSWORD_CHANGE, "Cambio de contraseña"),
        (ACTION_PASSWORD_RESET,  "Restablecimiento de contraseña"),
        (ACTION_ASSIGN_GROUP,    "Asignación de grupo"),
        (ACTION_REMOVE_GROUP,    "Remoción de grupo"),
        (ACTION_ASSIGN_PERM,     "Asignación de permiso"),
        (ACTION_REMOVE_PERM,     "Remoción de permiso"),
        (ACTION_SIGN_LOAN,       "Firma de préstamo"),
    ]

    # ── Campos del modelo ─────────────────────────────────────────────────

    # Quién ejecutó la acción. SET_NULL para no perder el log si el usuario
    # se elimina lógicamente.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Usuario que ejecutó la acción. Null si fue el sistema.",
    )

    # Nombre completo del actor en el momento del evento (snapshot).
    # Se guarda por separado para que el log no cambie si el nombre del
    # usuario cambia más adelante.
    actor_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Nombre completo del actor al momento del evento.",
    )

    module = models.CharField(
        max_length=30,
        choices=MODULE_CHOICES,
        db_index=True,
    )

    action = models.CharField(
        max_length=30,
        choices=ACTION_CHOICES,
        db_index=True,
    )

    # PK del objeto afectado (puede ser cualquier tabla — solo guardamos el id).
    target_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="PK del objeto afectado.",
    )

    # Descripción legible del objeto en el momento del evento.
    target_repr = models.CharField(
        max_length=200,
        blank=True,
        help_text="Descripción del objeto afectado (nombre, email, etc.).",
    )

    # Contexto adicional de la acción (campos modificados, motivos, etc.).
    detail = models.TextField(
        blank=True,
        help_text="Detalle adicional: campos modificados, motivo, observaciones.",
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP del cliente que originó la acción.",
    )

    # Momento del evento — siempre UTC.
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        db_table = "audit_log"
        verbose_name = "Entrada de auditoría"
        verbose_name_plural = "Historial de auditoría"
        ordering = ["-timestamp"]

    def __str__(self):
        return (
            f"[{self.timestamp:%H:%M %d/%m/%Y}] "
            f"{self.actor_name or 'Sistema'} — "
            f"{self.get_module_display()} / {self.get_action_display()}"
        )
