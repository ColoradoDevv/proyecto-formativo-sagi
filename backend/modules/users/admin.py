#
# Configuración del admin de Django para el módulo users.
# Interfaz simplificada para gestionar usuarios y sus grupos.
#

from django.contrib import admin
from .models import User, Role, DocumentType
from modules.permissions.models import UserGroup


class UserGroupInline(admin.TabularInline):
    """Inline admin para asignar grupos a usuarios"""
    model = UserGroup
    extra = 1
    verbose_name = "Grupo"
    verbose_name_plural = "Grupos del Usuario"


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """
    Admin personalizado para usuarios.
    Simplificado para solo mostrar asignación de grupos.
    Los permisos se heredan automáticamente del grupo asignado.
    """

    list_display = (
        'email',
        'first_name',
        'last_name',
        'is_active',
        'is_superuser',
        'get_groups'
    )
    list_filter = ('is_active', 'is_superuser', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name', 'document_number')
    ordering = ('email',)

    # Inlines para editar grupos desde el usuario
    inlines = [UserGroupInline]

    # Fieldsets organizados de forma intuitiva
    fieldsets = (
        ('Información de Login', {
            'fields': ('email', 'password', 'is_active')
        }),
        ('Datos Personales', {
            'fields': (
                'first_name',
                'last_name',
                'document_type',
                'document_number',
                'phone_number',
                'second_phone_number',
                'address',
                'profile_picture',
            )
        }),
        ('Información Institucional', {
            'fields': (
                'institutional_email',
                'start_date',
                'end_date',
                'is_instructor_planta',
                'is_accountable',
            )
        }),
        ('Protección de Datos (Ley 1581 de 2012)', {
            'description': 'Autorización otorgada al crear el usuario. Es histórica y no editable.',
            'fields': ('data_consent', 'data_consent_at')
        }),
        ('Permisos y Roles', {
            'description': 'Los permisos se heredan automáticamente del grupo asignado abajo.',
            'fields': ('is_superuser', 'is_staff')
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        # El consentimiento es histórico: visible pero nunca editable.
        base = list(super().get_readonly_fields(request, obj))
        return base + ['data_consent', 'data_consent_at']

    def get_groups(self, obj):
        """Muestra los grupos del usuario en el listado"""
        groups = obj.user_groups.all()
        if not groups:
            return "—"
        return ", ".join([g.group.name for g in groups])

    get_groups.short_description = 'Grupos'

    def save_model(self, request, obj, form, change):
        """Hook para hacer tareas adicionales al guardar"""
        # Si la contraseña cambió y no está hasheada, hashearla.
        # Igual que en UserSerializer.create()/.update() y ResendCredentialsView:
        # cualquier contraseña que no fije el propio usuario debe forzar un
        # cambio en el siguiente login. Sin esto, restablecer una contraseña
        # desde este panel dejaba al usuario con una contraseña permanente
        # que nadie más que el admin conocía, sin que el sistema se lo pidiera
        # cambiar.
        if 'password' in form.changed_data:
            obj.set_password(obj.password)
            obj.must_change_password = True

        super().save_model(request, obj, form, change)

        # Si es superuser, asignarlo automáticamente al grupo SADMIN
        if obj.is_superuser:
            from modules.permissions.models import Group
            try:
                sadmin_group = Group.objects.get(name='SADMIN')
                if not obj.user_groups.filter(group=sadmin_group).exists():
                    obj.user_groups.create(group=sadmin_group)
            except Group.DoesNotExist:
                pass


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Admin para Role (tabla legada, puede ser eliminada)"""
    list_display = ('name', 'description')
    search_fields = ('name',)


@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    """Admin para tipos de documento"""
    list_display = ('name', 'description')
    search_fields = ('name',)