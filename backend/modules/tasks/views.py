# Vistas del modulo tasks.
# Aqui viven los endpoints CRUD para definiciones y asignaciones.

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import TaskDefinition, TaskAssignment, TaskEvidence
from .serializers import (
    TaskDefinitionSerializer,
    TaskAssignmentSerializer,
    TaskEvidenceSerializer,
)
from modules.permissions.permissions_drf import HasPermission, IsSuperUser
from sia_api.emailing import send_sagi_email
from sia_api.file_validation import validate_evidence_upload

# Estados desde los que el asignado puede marcar su tarea para revisión.
FINISHABLE_STATES = {'Pendiente', 'En progreso'}


class TaskDefinitionViewSet(viewsets.ModelViewSet):
    # CRUD de la plantilla de tarea (TaskDefinition).
    # Anotamos cuántas asignaciones tiene cada una para mostrarlo en el listado.
    queryset = TaskDefinition.objects.annotate(
        assignments_count=Count("assignments")
    ).order_by('id')
    serializer_class = TaskDefinitionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_task")]
        if self.action == "create":
            return [HasPermission("create_task")]
        if self.action in ("update", "partial_update"):
            return [HasPermission("edit_task")]
        if self.action == "destroy":
            return [HasPermission("delete_task")]
        return [IsSuperUser()]


class TaskAssignmentViewSet(viewsets.ModelViewSet):
    # CRUD de la asignacion de tarea a un usuario o grupo (TaskAssignment).
    queryset = TaskAssignment.objects.select_related('task', 'user', 'group').all().order_by('id')
    serializer_class = TaskAssignmentSerializer

    def _is_own_scope_request(self):
        """True si pide SOLO lo propio sin el código global:
        - ?scope=user&user=<yo>, o
        - ?scope=mine (las mías + las de mis grupos).
        No expone datos ajenos: el queryset lo limita.
        """
        if not self.request.user or not self.request.user.is_authenticated:
            return False
        params = self.request.query_params
        scope = params.get("scope")
        if scope == "mine":
            return True
        if scope != "user":
            return False
        try:
            return int(params.get("user")) == self.request.user.id
        except (TypeError, ValueError):
            return False

    def _own_assignments_filter(self):
        """Q() con mis asignaciones directas + las de mis grupos activos."""
        from modules.permissions.models import UserGroup
        my_group_ids = UserGroup.objects.filter(
            user=self.request.user, group__is_active=True,
        ).values_list("group_id", flat=True)
        return Q(user=self.request.user) | Q(group_id__in=my_group_ids)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            if self.action == "list" and self._is_own_scope_request():
                return [IsAuthenticated()]
            return [HasPermission("view_task_assignment")]
        if self.action == "create":
            return [HasPermission("create_task_assignment")]
        if self.action in ("update", "partial_update"):
            # El asignado puede marcar SU tarea como terminada (solo ese
            # cambio de estado); cualquier otra edición exige el código.
            if self._is_own_finish_request():
                return [IsAuthenticated()]
            return [HasPermission("edit_task_assignment")]
        if self.action == "destroy":
            return [HasPermission("delete_task_assignment")]
        if self.action == "evidence":
            # Subir evidencias: el asignado o quien tiene el código de edición.
            from modules.permissions.services import PermissionService
            if self._is_own_assignment() or PermissionService.has_permission(
                self.request.user, "edit_task_assignment"
            ):
                return [IsAuthenticated()]
            return [HasPermission("edit_task_assignment")]
        return [IsSuperUser()]

    def _get_target_object(self):
        """Objeto SIN disparar check_object_permissions.
        Llamar a self.get_object() dentro de get_permissions() causa
        recursión infinita (get_object → check_object_permissions →
        get_permissions → get_object …)."""
        from rest_framework.generics import get_object_or_404
        queryset = self.filter_queryset(self.get_queryset())
        lookup = {self.lookup_field: self.kwargs.get(
            self.lookup_url_kwarg or self.lookup_field)}
        return get_object_or_404(queryset, **lookup)

    def _is_own_assignment(self):
        """True si quien llama es destinatario de la asignación."""
        try:
            assignment = self._get_target_object()
        except Exception:
            return False
        user = self.request.user
        if not user or not user.is_authenticated:
            return False
        if assignment.scope == TaskAssignment.SCOPE_USER:
            return assignment.user_id == user.id
        if assignment.scope == TaskAssignment.SCOPE_GROUP and assignment.group_id:
            from modules.permissions.models import UserGroup
            return UserGroup.objects.filter(user=user, group_id=assignment.group_id).exists()
        return False

    def _is_own_finish_request(self):
        """True si es el asignado marcando su tarea como terminada."""
        if not self.request.user or not self.request.user.is_authenticated:
            return False
        data = self.request.data or {}
        if set(data.keys()) - {"state"}:
            return False
        if data.get("state") != "En revisión":
            return False
        try:
            assignment = self._get_target_object()
        except Exception:
            return False
        if assignment.state not in FINISHABLE_STATES:
            return False
        return self._is_own_assignment()

    def get_queryset(self):
        # Filtros: ?user=<id>, ?group=<id>, ?task=<id>, ?state=<value>, ?scope=<user|group>.
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        task_id = self.request.query_params.get('task')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        state = self.request.query_params.get('state')
        if state:
            queryset = queryset.filter(state=state)
        scope = self.request.query_params.get('scope')
        if scope in (TaskAssignment.SCOPE_USER, TaskAssignment.SCOPE_GROUP):
            queryset = queryset.filter(scope=scope)
        elif scope == 'mine':
            # "Mis tareas": directas + las de mis grupos (ya autorizado
            # en get_permissions por _is_own_scope_request).
            queryset = queryset.filter(self._own_assignments_filter())
        return queryset.select_related('task', 'user', 'group').prefetch_related('evidences')

    def perform_create(self, serializer):
        assignment = serializer.save(created_by=self.request.user)
        assignment.refresh_from_db()
        _notify_task_assigned(assignment)

    def perform_update(self, serializer):
        old = {
            "state": serializer.instance.state,
            "start_date": serializer.instance.start_date,
            "end_date": serializer.instance.end_date,
            "requires_evidence": serializer.instance.requires_evidence,
        }
        assignment = serializer.save()
        assignment.refresh_from_db()
        _notify_task_updated(assignment, old, self.request.user)

    @action(detail=True, methods=["post"], url_path="evidence")
    def evidence(self, request, pk=None):
        """POST /api/tasks/assignments/<id>/evidence/ — adjuntar evidencia
        (multipart: file + description opcional)."""
        assignment = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"file": "Debe adjuntar un archivo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_evidence_upload(upload, field="file")
        except Exception as exc:
            return Response(
                {"file": str(getattr(exc, "detail", exc))},
                status=status.HTTP_400_BAD_REQUEST,
            )
        evidence = TaskEvidence.objects.create(
            assignment=assignment,
            file=upload,
            description=(request.data.get("description") or "")[:255],
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return Response(TaskEvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)


def _task_front_url():
    from django.conf import settings
    return (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")


def _notify_task_assigned(assignment):
    """Avisa a los destinatarios que tienen una tarea nueva."""
    recipients = [e for e in assignment.assignee_emails() if e]
    if not recipients:
        return
    details = [
        ("Tarea", assignment.task.name),
        ("Fecha límite", str(assignment.end_date)),
        ("Estado", assignment.state),
    ]
    if assignment.requires_evidence:
        details.append(("Evidencias", "Obligatorias al finalizar"))
    context = {
        "paragraphs": [f"Se te asignó una nueva tarea: {assignment.task.description}"],
        "details": details,
        "button": {"label": "Ver mis tareas", "url": f"{_task_front_url()}/tareas"},
    }
    for email in recipients:
        try:
            send_sagi_email(
                email,
                subject=f"Nueva tarea asignada: {assignment.task.name} — SAGI",
                template="task_assigned.html",
                context={"greeting_name": "", **context},
            )
        except Exception:
            pass


def _notify_task_updated(assignment, old, actor):
    """Avisa según quién cambió qué:
    - El asignado marcó En revisión → se avisa al revisor (quien asignó).
    - Cualquier otro cambio de otro autor → se avisa a los asignados.
    """
    actor_id = getattr(actor, "id", None)
    new_state = assignment.state
    old_state = old.get("state")

    if (
        new_state == "En revisión"
        and old_state in FINISHABLE_STATES
        and assignment.created_by_id
        and assignment.created_by_id != actor_id
        and assignment.created_by.is_active
    ):
        try:
            send_sagi_email(
                assignment.created_by.email,
                subject=f"Tarea entregada para revisión: {assignment.task.name} — SAGI",
                template="task_submitted.html",
                context={
                    "greeting_name": assignment.created_by.first_name,
                    "submitter": (
                        f"{actor.first_name} {actor.last_name}".strip()
                        if getattr(actor, "first_name", None) else "El asignado"
                    ),
                    "details": [
                        ("Tarea", assignment.task.name),
                        ("Destinatario", assignment.recipient_name),
                        ("Estado", new_state),
                        ("Evidencias", str(assignment.evidences.count())),
                    ],
                    "button": {"label": "Revisar tarea", "url": f"{_task_front_url()}/tareas"},
                },
            )
        except Exception:
            pass
        return

    recipients = [
        e for e in assignment.assignee_emails() if e
    ]
    # No auto-avisarse: si el actor es uno de los asignados, se excluye.
    actor_email = getattr(actor, "email", "")
    recipients = [e for e in recipients if e != actor_email]
    changed = [
        label for label, key in [
            ("Estado", "state"),
            ("Fecha de inicio", "start_date"),
            ("Fecha de fin", "end_date"),
        ]
        if str(old.get(key)) != str(getattr(assignment, key))
    ]
    if str(old.get("requires_evidence")) != str(assignment.requires_evidence):
        changed.append("Evidencias obligatorias")
    if not recipients or not changed:
        return
    context = {
        "paragraphs": [f"Tu tarea asignada tuvo cambios: {', '.join(changed)}."],
        "details": [
            ("Tarea", assignment.task.name),
            ("Estado actual", new_state),
            ("Fecha límite", str(assignment.end_date)),
        ],
        "button": {"label": "Ver mis tareas", "url": f"{_task_front_url()}/tareas"},
        "warning": "Si no reconoces este cambio, contacta al administrador.",
    }
    for email in recipients:
        try:
            send_sagi_email(
                email,
                subject=f"Actualización en tu tarea: {assignment.task.name} — SAGI",
                template="task_updated.html",
                context={"greeting_name": "", **context},
            )
        except Exception:
            pass
