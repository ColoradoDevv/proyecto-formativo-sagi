# Generated migration to load initial permissions and groups

from django.db import migrations


def create_initial_permissions(apps, schema_editor):
    """
    Crea permisos iniciales del sistema según especificación de requerimientos.
    Matriz de permisos alineada con RFADMIN01-RFADMIN49
    """
    Permission = apps.get_model('permissions', 'Permission')

    permissions_data = [
        # AUTENTICACIÓN Y SESIÓN (disponible para todos)
        ('view_own_profile', 'Ver perfil propio', 'Ver la información de perfil del usuario actual'),
        ('change_password', 'Cambiar contraseña', 'Cambiar la contraseña personal'),

        # GESTIÓN DE USUARIOS (RFADMIN02-RFADMIN07)
        ('list_users', 'Listar usuarios', 'RFADMIN06 - Ver listado de todos los usuarios'),
        ('create_user', 'Crear usuario', 'RFADMIN02 - Crear nuevos usuarios con diferentes roles'),
        ('view_user', 'Ver detalles de usuario', 'RFADMIN03 - Ver información detallada de un usuario'),
        ('update_user', 'Actualizar usuario', 'RFADMIN04 - Modificar datos de un usuario'),
        ('disable_user', 'Habilitar/Deshabilitar usuario', 'RFADMIN05 - Cambiar estado de usuario'),
        ('export_users', 'Exportar usuarios', 'RFADMIN07 - Generar reportes de usuarios'),

        # MATERIALES DEVOLUTIVOS (RFADMIN08-RFADMIN13)
        ('create_returnable_material', 'Crear material devolutivo', 'RFADMIN08 - Registrar nuevo material devolutivo'),
        ('view_returnable_material', 'Ver material devolutivo', 'RFADMIN09 - Visualizar detalles de material devolutivo'),
        ('update_returnable_material', 'Actualizar material devolutivo', 'RFADMIN10 - Modificar datos de material devolutivo'),
        ('disable_returnable_material', 'Habilitar/Deshabilitar material devolutivo', 'RFADMIN11 - Cambiar disponibilidad de material'),
        ('list_returnable_materials', 'Listar materiales devolutivos', 'RFADMIN12 - Ver listado de materiales devolutivos'),
        ('export_returnable_materials', 'Exportar materiales devolutivos', 'RFADMIN13 - Generar reportes de materiales devolutivos'),

        # MATERIALES DE CONSUMO (RFADMIN14-RFADMIN19)
        ('create_consumable_material', 'Crear material de consumo', 'RFADMIN14 - Registrar nuevo material de consumo'),
        ('view_consumable_material', 'Ver material de consumo', 'RFADMIN15 - Visualizar detalles de material de consumo'),
        ('update_consumable_material', 'Actualizar material de consumo', 'RFADMIN16 - Modificar datos de material de consumo'),
        ('disable_consumable_material', 'Habilitar/Deshabilitar material de consumo', 'RFADMIN17 - Cambiar disponibilidad de material'),
        ('list_consumable_materials', 'Listar materiales de consumo', 'RFADMIN18 - Ver listado de materiales de consumo'),
        ('export_consumable_materials', 'Exportar materiales de consumo', 'RFADMIN19 - Generar reportes de materiales de consumo'),

        # PRÉSTAMOS (RFADMIN20-RFADMIN26)
        ('create_loan', 'Crear préstamo', 'RFADMIN20 - Crear nuevo préstamo de materiales'),
        ('view_loan', 'Ver detalles de préstamo', 'RFADMIN23 - Visualizar información de préstamo'),
        ('update_loan', 'Actualizar préstamo', 'RFADMIN24 - Modificar datos de préstamo activo'),
        ('list_loans', 'Listar préstamos', 'RFADMIN25 - Ver listado de préstamos'),
        ('export_loans', 'Exportar préstamos', 'RFADMIN26 - Generar reportes de préstamos'),
        ('return_material', 'Devolver material devolutivo', 'RFADMIN21 - Registrar devolución de material devolutivo'),
        ('register_surplus', 'Registrar sobrante', 'RFADMIN22 - Registrar cantidad sobrante de consumible'),
        ('validate_loan_return', 'Validar devolución', 'Validar y confirmar devolucion de materiales'),

        # GESTIÓN DE MARCAS (RFADMIN29-RFADMIN32) - Solo ADMIN
        ('create_brand', 'Crear marca', 'RFADMIN29 - Registrar nueva marca de material'),
        ('list_brands', 'Listar marcas', 'RFADMIN30 - Ver listado de marcas disponibles'),
        ('update_brand', 'Actualizar marca', 'RFADMIN31 - Modificar nombre de marca existente'),
        ('disable_brand', 'Habilitar/Deshabilitar marca', 'RFADMIN32 - Cambiar disponibilidad de marca'),

        # GESTIÓN DE ROLES Y PERMISOS (RFADMIN41-RFADMIN45) - Solo SADMIN
        ('create_role', 'Crear rol', 'RFADMIN41 - Registrar nuevo rol del sistema'),
        ('list_roles', 'Listar roles', 'RFADMIN42 - Ver listado de roles disponibles'),
        ('update_role', 'Actualizar rol', 'RFADMIN43 - Modificar nombre de rol'),
        ('disable_role', 'Habilitar/Deshabilitar rol', 'RFADMIN44 - Cambiar estado de rol'),
        ('manage_role_permissions', 'Gestionar permisos de rol', 'RFADMIN45 - Asignar/revocar permisos a un rol'),

        # GESTIÓN DE TAREAS (RFADMIN46-RFADMIN49) - ADMIN/SADMIN
        ('create_task', 'Crear tarea', 'RFADMIN46 - Crear nueva tarea asignada a usuario'),
        ('view_task', 'Ver detalles de tarea', 'RFADMIN48 - Visualizar información de tarea'),
        ('update_task', 'Actualizar tarea', 'RFADMIN49 - Modificar datos de tarea'),
        ('list_tasks', 'Listar tareas', 'RFADMIN47 - Ver listado de tareas'),
    ]

    for codename, name, description in permissions_data:
        Permission.objects.get_or_create(
            codename=codename,
            defaults={
                'name': name,
                'description': description,
            }
        )


def create_initial_groups(apps, schema_editor):
    """
    Crea grupos iniciales (SADMIN, ADMIN, INST, INV) y asigna permisos.
    Basado en matriz de requerimientos (sección 10, tabla Matriz de acciones por rol)
    """
    Permission = apps.get_model('permissions', 'Permission')
    Group = apps.get_model('permissions', 'Group')

    # ========== GRUPO: SADMIN (Superadministrador) ==========
    sadmin_group, _ = Group.objects.get_or_create(
        name='SADMIN',
        defaults={
            'description': 'Superadministrador - Acceso total al sistema. Gestiona roles, permisos y configuración global.'
        }
    )
    # SADMIN tiene todos los permisos del sistema
    sadmin_group.permissions.set(Permission.objects.all())

    # ========== GRUPO: ADMIN (Administrador) ==========
    admin_group, _ = Group.objects.get_or_create(
        name='ADMIN',
        defaults={
            'description': 'Administrador - Gestión completa de usuarios, materiales, préstamos, reportes, marcas y tareas'
        }
    )

    # Permisos para ADMIN según matriz de requerimientos
    admin_permissions = Permission.objects.filter(
        codename__in=[
            # Autenticación
            'view_own_profile', 'change_password',
            # Usuarios (RFADMIN02-07)
            'list_users', 'create_user', 'view_user', 'update_user', 'disable_user', 'export_users',
            # Materiales Devolutivos (RFADMIN08-13)
            'create_returnable_material', 'view_returnable_material', 'update_returnable_material',
            'disable_returnable_material', 'list_returnable_materials', 'export_returnable_materials',
            # Materiales de Consumo (RFADMIN14-19)
            'create_consumable_material', 'view_consumable_material', 'update_consumable_material',
            'disable_consumable_material', 'list_consumable_materials', 'export_consumable_materials',
            # Préstamos (RFADMIN20-26)
            'create_loan', 'view_loan', 'update_loan', 'list_loans', 'export_loans',
            'return_material', 'register_surplus', 'validate_loan_return',
            # Marcas (RFADMIN29-32)
            'create_brand', 'list_brands', 'update_brand', 'disable_brand',
            # Tareas (RFADMIN46-49)
            'create_task', 'view_task', 'update_task', 'list_tasks',
            # Roles y permisos (solo habilitar/deshabilitar)
            'disable_role',
        ]
    )
    admin_group.permissions.set(admin_permissions)

    # ========== GRUPO: INST (Instructor) ==========
    inst_group, _ = Group.objects.get_or_create(
        name='INST',
        defaults={
            'description': 'Instructor - Gestión de materiales, préstamos y reportes; sin gestión de usuarios ni marcas'
        }
    )

    # Permisos para INST según matriz de requerimientos
    inst_permissions = Permission.objects.filter(
        codename__in=[
            # Autenticación
            'view_own_profile', 'change_password',
            # Materiales Devolutivos (RFADMIN08-13)
            'create_returnable_material', 'view_returnable_material', 'update_returnable_material',
            'disable_returnable_material', 'list_returnable_materials', 'export_returnable_materials',
            # Materiales de Consumo (RFADMIN14-19)
            'create_consumable_material', 'view_consumable_material', 'update_consumable_material',
            'disable_consumable_material', 'list_consumable_materials', 'export_consumable_materials',
            # Préstamos (RFADMIN20-26)
            'create_loan', 'view_loan', 'update_loan', 'list_loans', 'export_loans',
            'return_material', 'register_surplus', 'validate_loan_return',
        ]
    )
    inst_group.permissions.set(inst_permissions)

    # ========== GRUPO: INV (Invitado) ==========
    inv_group, _ = Group.objects.get_or_create(
        name='INV',
        defaults={
            'description': 'Invitado - Solo visualización: perfil propio, materiales, préstamos donde participa; puede generar reportes'
        }
    )

    # Permisos para INV según matriz de requerimientos
    inv_permissions = Permission.objects.filter(
        codename__in=[
            # Autenticación
            'view_own_profile', 'change_password',
            # Ver materiales (solo lectura)
            'view_returnable_material', 'list_returnable_materials',
            'view_consumable_material', 'list_consumable_materials',
            # Préstamos (solo sus propios)
            'view_loan', 'list_loans', 'export_loans',
            'return_material', 'register_surplus',
        ]
    )
    inv_group.permissions.set(inv_permissions)


class Migration(migrations.Migration):

    dependencies = [
        ('permissions', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_initial_permissions),
        migrations.RunPython(create_initial_groups),
    ]
