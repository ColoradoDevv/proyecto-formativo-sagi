# Modelo del modulo tasks (Tareas reutilizables con asignaciones por usuario o grupo).

from django.db import models
from django.conf import settings
from django.utils import timezone


STATE_CHOICES = [
    ('Pendiente', 'Pendiente'),
    ('En progreso', 'En progreso'),
    ('En revisión', 'En revisión'),
    ('Completada', 'Completada'),
    ('Cancelada', 'Cancelada'),
]


class TaskDefinition(models.Model):
    # Plantilla logica de la tarea: lo que se reutiliza entre varios destinatarios.
    # No tiene destinatario ni estado: solo define "que es" la tarea.

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'DefinicionesTareas'
        verbose_name = 'Definicion de tarea'
        verbose_name_plural = 'Definiciones de tareas'

    def __str__(self):
        return self.name


class TaskAssignment(models.Model):
    # Asignacion concreta: una definicion entregada a UN destinatario
    # (un usuario individual o un grupo), con su propio estado, fechas
    # y trazabilidad basica.

    SCOPE_USER = 'user'
    SCOPE_GROUP = 'group'
    SCOPE_CHOICES = [
        (SCOPE_USER, 'Usuario individual'),
        (SCOPE_GROUP, 'Grupo de usuarios'),
    ]

    id = models.AutoField(primary_key=True)
    task = models.ForeignKey(
        TaskDefinition,
        on_delete=models.CASCADE,
        related_name='assignments',
    )

    # Define a quien se asigna la tarea. Exactamente uno de los dos tendra
    # valor, segun `scope`. La constraint se valida a nivel modelo y BD.
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='task_assignments',
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        'permissions.Group',
        on_delete=models.RESTRICT,
        related_name='task_assignments',
        null=True,
        blank=True,
    )

    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default='Pendiente',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Si es True, el asignado DEBE adjuntar evidencias al marcar como terminada.
    requires_evidence = models.BooleanField(
        default=False,
        help_text="Exige evidencias (archivos/fotos) al finalizar la tarea.",
    )

    # Quién asignó la tarea (para notificarle la entrega/revisión).
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='created_task_assignments',
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'AsignacionesTareas'
        verbose_name = 'Asignacion de tarea'
        verbose_name_plural = 'Asignaciones de tareas'
        constraints = [
            # Coherencia scope <-> FK: si scope=user, user obligatorio y group nulo;
            # si scope=group, group obligatorio y user nulo.
            models.CheckConstraint(
                name='task_assignment_scope_consistency',
                condition=(
                    models.Q(scope='user',  user__isnull=False, group__isnull=True) |
                    models.Q(scope='group', user__isnull=True,  group__isnull=False)
                ),
            ),
            # Unicidad por destinatario, aplicada solo a filas donde ese FK no es nulo.
            models.UniqueConstraint(
                name='unique_task_user_assignment',
                fields=['task', 'user'],
                condition=models.Q(user__isnull=False),
            ),
            models.UniqueConstraint(
                name='unique_task_group_assignment',
                fields=['task', 'group'],
                condition=models.Q(group__isnull=False),
            ),
        ]

    def __str__(self):
        if self.scope == self.SCOPE_GROUP:
            return f"{self.task.name} -> {self.group}"
        return f"{self.task.name} -> {self.user}"

    def save(self, *args, **kwargs):
        # Mantener completed_at consistente con el estado.
        if self.state == 'Completada' and not self.completed_at:
            self.completed_at = timezone.now()
        elif self.state != 'Completada' and self.completed_at:
            self.completed_at = None
        super().save(*args, **kwargs)

    @property
    def recipient_name(self):
        if self.scope == self.SCOPE_GROUP:
            return self.group.name if self.group else ""
        if self.user:
            full = f"{self.user.first_name} {self.user.last_name}".strip()
            return full or self.user.email
        return ""

    def assignee_emails(self):
        """Correos de quienes tienen la tarea (usuario o miembros del grupo)."""
        if self.scope == self.SCOPE_GROUP and self.group_id:
            from modules.permissions.models import UserGroup
            return list(
                UserGroup.objects.filter(user__is_active=True, group_id=self.group_id)
                .values_list("user__email", flat=True)
                .distinct()
            )
        if self.user_id and self.user.is_active:
            return [self.user.email]
        return []


class TaskEvidence(models.Model):
    # Prueba adjunta a una asignación (foto, documento, etc.).
    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name='evidences',
    )
    file = models.FileField(upload_to='task_evidence/%Y/%m/')
    description = models.CharField(max_length=255, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='task_evidences',
        null=True,
        blank=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'EvidenciasTareas'
        verbose_name = 'Evidencia de tarea'
        verbose_name_plural = 'Evidencias de tareas'

    def __str__(self):
        return f"Evidencia {self.id} de asignación {self.assignment_id}"
