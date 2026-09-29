#
# Serializers para la API de permisos y grupos.
#

from rest_framework import serializers
from .models import Permission, Group, UserPermission, UserGroup, GroupPermission, SYSTEM_GROUP_NAME


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer para permisos"""

    class Meta:
        model = Permission
        fields = ["id", "codename", "name", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class GroupPermissionSerializer(serializers.ModelSerializer):
    """Serializer para permisos de grupo (relación M2M)"""

    permission_codename = serializers.CharField(
        source="permission.codename", read_only=True
    )
    permission_name = serializers.CharField(source="permission.name", read_only=True)

    class Meta:
        model = GroupPermission
        fields = ["id", "permission", "permission_codename", "permission_name", "assigned_at"]
        read_only_fields = ["id", "assigned_at"]


class GroupDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para grupos (incluye permisos)"""

    permissions = PermissionSerializer(many=True, read_only=True)
    group_permissions = GroupPermissionSerializer(many=True, read_only=True)

    def validate_name(self, value):
        value = value.strip()
        if value.upper() == SYSTEM_GROUP_NAME:
            raise serializers.ValidationError("Este es un grupo reservado del sistema.")
        # Unicidad insensible a mayúsculas/minúsculas: evita que "Admin" y
        # "ADMIN" coexistan como grupos distintos.
        qs = Group.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un grupo con ese nombre.")
        return value

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "permissions",
            "group_permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class GroupListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listado de grupos"""

    permission_count = serializers.SerializerMethodField()

    def get_permission_count(self, obj):
        return obj.permissions.count()

    class Meta:
        model = Group
        fields = ["id", "name", "description", "permission_count", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserPermissionSerializer(serializers.ModelSerializer):
    """Serializer para permisos de usuario (relación M2M)"""

    permission_codename = serializers.CharField(
        source="permission.codename", read_only=True
    )
    permission_name = serializers.CharField(source="permission.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserPermission
        fields = [
            "id",
            "user",
            "user_email",
            "permission",
            "permission_codename",
            "permission_name",
            "reason",
            "assigned_at",
        ]
        read_only_fields = ["id", "assigned_at"]


class UserGroupSerializer(serializers.ModelSerializer):
    """Serializer para grupos de usuario (relación M2M)"""

    group_name = serializers.CharField(source="group.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserGroup
        fields = ["id", "user", "user_email", "group", "group_name", "joined_at"]
        read_only_fields = ["id", "joined_at"]


class AssignPermissionSerializer(serializers.Serializer):
    """Serializer para asignar permisos a usuarios"""

    permission_codename = serializers.CharField(max_length=100)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        fields = ["permission_codename", "reason"]


class AssignGroupSerializer(serializers.Serializer):
    """Serializer para asignar usuarios a grupos"""

    group_name = serializers.CharField(max_length=100)

    class Meta:
        fields = ["group_name"]
