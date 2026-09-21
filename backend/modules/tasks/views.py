# Vistas del modulo tasks.
# Aqui viven los endpoints CRUD para definiciones y asignaciones.

from rest_framework import viewsets
from .models import TaskDefinition, TaskAssignment
from .serializers import TaskDefinitionSerializer, TaskAssignmentSerializer
from modules.permissions.permissions_drf import HasPermission, IsSuperUser


class TaskDefinitionViewSet(viewsets.ModelViewSet):
    # CRUD de la plantilla de tarea (TaskDefinition).
    queryset = TaskDefinition.objects.all().order_by('id')
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

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPermission("view_task_assignment")]
        if self.action == "create":
            return [HasPermission("create_task_assignment")]
        if self.action in ("update", "partial_update"):
            # Solo admin/supervisor con el permiso pueden cambiar estados/fechas.
            return [HasPermission("edit_task_assignment")]
        if self.action == "destroy":
            return [HasPermission("delete_task_assignment")]
        return [IsSuperUser()]

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
        return queryset
