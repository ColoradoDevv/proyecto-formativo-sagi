#
# Modelos del módulo de permisos y control de acceso.
# Completamente independiente de otros módulos.
#

from django.db import models
from modules.users.models import User


SYSTEM_GROUP_NAME = "SADMIN"


class Permission(models.Model):
    """
    Definición granular de permisos del sistema.
    Ejemplo: 'list_users', 'create_loan', 'approve_loan', etc.
    """
    codename = models.CharField(
        max_length=100,
        unique=True,
        help_text="Identificador único en formato snake_case. Ej: 'list_users'"
    )
    name = models.CharField(
        max_length=150,
        help_text="Nombre legible para mostrar. Ej: 'Listar usuarios'"
    )
    description = models.TextField(
        blank=True,
        help_text="Descripción detallada de qué permite este permiso"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.codename} - {self.name}"

    class Meta:
        db_table = 'permissions'
        verbose_name = 'Permiso'
        verbose_name_plural = 'Permisos'
        ordering = ['codename']


class Group(models.Model):
    """
    Agrupación de usuarios con un conjunto común de permisos.
    Ejemplo: 'Administradores', 'Personal', 'Clientes', etc.
    """
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nombre del grupo. Ej: 'Administradores'"
    )
    description = models.TextField(
        blank=True,
        help_text="Descripción del rol y responsabilidades del grupo"
    )
    permissions = models.ManyToManyField(
        Permission,
        through='GroupPermission',
        blank=True,
        help_text="Permisos asignados a este grupo"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Indica si el grupo está activo. Los grupos inactivos no pueden recibir nuevos usuarios."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'groups'
        verbose_name = 'Grupo'
        verbose_name_plural = 'Grupos'
        ordering = ['name']


class GroupPermission(models.Model):
    """
    Relación many-to-many explícita entre grupos y permisos.
    Permite auditar cuándo se asignó cada permiso a cada grupo.
    """
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='group_permissions'
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name='group_permissions'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.group.name} → {self.permission.codename}"

    class Meta:
        db_table = 'group_permissions'
        unique_together = ('group', 'permission')
        verbose_name = 'Permiso de Grupo'
        verbose_name_plural = 'Permisos de Grupo'


class UserPermission(models.Model):
    """
    Permisos asignados directamente a un usuario (además de los heredados por grupo).
    Útil para excepciones y permisos ad-hoc.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='direct_permissions'
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name='direct_user_permissions'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(
        blank=True,
        help_text="Razón por la cual se asignó este permiso específico"
    )

    def __str__(self):
        return f"{self.user.email} → {self.permission.codename}"

    class Meta:
        db_table = 'user_permissions'
        unique_together = ('user', 'permission')
        verbose_name = 'Permiso de Usuario'
        verbose_name_plural = 'Permisos de Usuario'


class UserGroup(models.Model):
    """
    Membresía de usuarios en grupos.
    Un usuario puede pertenecer a múltiples grupos.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_groups'
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='user_groups'
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} ∈ {self.group.name}"

    class Meta:
        db_table = 'user_groups'
        unique_together = ('user', 'group')
        verbose_name = 'Membresía de Usuario'
        verbose_name_plural = 'Membresías de Usuario'
