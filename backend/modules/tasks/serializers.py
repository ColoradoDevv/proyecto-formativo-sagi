# Serializers del modulo tasks.
# Convierte modelos a JSON y valida lo que llega.

from django.utils import timezone
from rest_framework import serializers
from .models import TaskDefinition, TaskAssignment


class TaskDefinitionSerializer(serializers.ModelSerializer):
    # Serializer para la plantilla de tarea (TaskDefinition).

    class Meta:
        model = TaskDefinition
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class TaskAssignmentSerializer(serializers.ModelSerializer):
    # Serializer para la asignacion de tarea (TaskAssignment) — puede ir
    # dirigida a un usuario individual o a un grupo.

    user_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    task_name = serializers.SerializerMethodField()
    recipient_name = serializers.CharField(read_only=True)

    class Meta:
        model = TaskAssignment
        fields = [
            'id',
            'task',
            'task_name',
            'scope',
            'user',
            'user_name',
            'group',
            'group_name',
            'recipient_name',
            'state',
            'start_date',
            'end_date',
            'assigned_at',
            'completed_at',
        ]
        read_only_fields = ['id', 'assigned_at', 'completed_at', 'recipient_name']

    def get_user_name(self, obj):
        if not obj.user:
            return None
        full = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full or obj.user.email

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_task_name(self, obj):
        return obj.task.name

    def validate(self, data):
        # Coherencia scope <-> destinatario.
        scope = data.get('scope', getattr(self.instance, 'scope', None))
        user = data.get('user', getattr(self.instance, 'user', None))
        group = data.get('group', getattr(self.instance, 'group', None))

        if scope == TaskAssignment.SCOPE_USER and not user:
            raise serializers.ValidationError(
                {"user": "Debe seleccionar un usuario cuando el alcance es 'Usuario'."}
            )
        if scope == TaskAssignment.SCOPE_USER and group:
            raise serializers.ValidationError(
                {"group": "No puede especificar grupo cuando el alcance es 'Usuario'."}
            )
        if scope == TaskAssignment.SCOPE_GROUP and not group:
            raise serializers.ValidationError(
                {"group": "Debe seleccionar un grupo cuando el alcance es 'Grupo'."}
            )
        if scope == TaskAssignment.SCOPE_GROUP and user:
            raise serializers.ValidationError(
                {"user": "No puede especificar usuario cuando el alcance es 'Grupo'."}
            )

        # end_date >= start_date.
        start = data.get('start_date', getattr(self.instance, 'start_date', None))
        end = data.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "La fecha de fin no puede ser anterior a la de inicio."}
            )

        # completed_at coherente con el estado.
        state = data.get('state', getattr(self.instance, 'state', None))
        completed_at = data.get('completed_at', getattr(self.instance, 'completed_at', None))
        if state == 'Completada' and not completed_at:
            data['completed_at'] = timezone.now()
        elif state and state != 'Completada' and completed_at is not None:
            data['completed_at'] = None

        return data
