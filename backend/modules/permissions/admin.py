#
# Configuración del admin de Django para permisos.
#

from django.contrib import admin
from .models import Permission, Group, GroupPermission, UserPermission, UserGroup


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("codename", "name", "created_at")
    list_filter = ("created_at",)
    search_fields = ("codename", "name", "description")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Información", {"fields": ("codename", "name", "description")}),
        ("Auditoría", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "permission_count", "created_at")
    list_filter = ("created_at",)
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at", "display_permissions")
    fieldsets = (
        ("Información", {"fields": ("name", "description")}),
        ("Permisos", {"fields": ("display_permissions",)}),
        ("Auditoría", {"fields": ("created_at", "updated_at")}),
    )

    def permission_count(self, obj):
        return obj.permissions.count()

    permission_count.short_description = "Cantidad de Permisos"

    def display_permissions(self, obj):
        """Mostrar permisos del grupo (solo lectura)"""
        perms = obj.permissions.all()
        if not perms:
            return "Sin permisos asignados"
        return ", ".join([p.codename for p in perms])

    display_permissions.short_description = "Permisos asignados"

    def get_readonly_fields(self, request, obj=None):
        """Permitir editar en creación pero solo lectura en actualización"""
        if obj:  # Si estamos editando
            return self.readonly_fields
        return ["created_at", "updated_at"]


@admin.register(GroupPermission)
class GroupPermissionAdmin(admin.ModelAdmin):
    list_display = ("group", "permission", "assigned_at")
    list_filter = ("group", "assigned_at")
    search_fields = ("group__name", "permission__codename")
    readonly_fields = ("assigned_at",)
    raw_id_fields = ("group", "permission")


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "assigned_at")
    list_filter = ("assigned_at",)
    search_fields = ("user__email", "permission__codename")
    readonly_fields = ("assigned_at",)
    raw_id_fields = ("user", "permission")
    fieldsets = (
        ("Información", {"fields": ("user", "permission")}),
        ("Detalles", {"fields": ("reason",)}),
        ("Auditoría", {"fields": ("assigned_at",)}),
    )


@admin.register(UserGroup)
class UserGroupAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "joined_at")
    list_filter = ("group", "joined_at")
    search_fields = ("user__email", "group__name")
    readonly_fields = ("joined_at",)
    raw_id_fields = ("user", "group")
