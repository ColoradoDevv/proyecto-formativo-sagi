#
# Comando de management para migrar datos de Role a Groups
# Uso: python manage.py migrate_roles_to_groups
#

from django.core.management.base import BaseCommand
from django.db.models import Q
from modules.users.models import User, Role
from modules.permissions.models import Group


class Command(BaseCommand):
    help = 'Migra usuarios de Role antiguo a Groups nuevo del módulo permissions'

    def handle(self, *args, **options):
        """
        Mapea usuarios que tenían un Role a sus grupos correspondientes.

        Mapeo:
        - Role "Administrador" → Group "ADMIN"
        - Role "Instructor" → Group "INST"
        - Role "Invitado" → Group "INV"
        """

        self.stdout.write(self.style.SUCCESS('\n=== Iniciando migración de Roles a Groups ===\n'))

        # Mapeo de Roles antigos a Groups nuevos
        role_to_group_mapping = {
            'Administrador': 'ADMIN',
            'Instructor': 'INST',
            'Invitado': 'INV',
            'admin': 'ADMIN',
            'instructor': 'INST',
            'invitado': 'INV',
        }

        try:
            # Obtener todos los usuarios que tienen un role (antes de eliminar el campo)
            # NOTA: Esto debe ejecutarse ANTES de que se elimine el campo role en la BD
            users_with_role = User.objects.filter(role__isnull=False)

            if not users_with_role.exists():
                self.stdout.write(
                    self.style.WARNING('No hay usuarios con role antiguo. Nada que migrar.')
                )
                return

            migrated_count = 0
            skipped_count = 0

            for user in users_with_role:
                role_name = user.role.name if user.role else None

                if not role_name:
                    skipped_count += 1
                    continue

                # Buscar el grupo correspondiente
                group_name = role_to_group_mapping.get(role_name)

                if not group_name:
                    self.stdout.write(
                        self.style.WARNING(
                            f'No hay mapeo para Role "{role_name}" (usuario: {user.email})'
                        )
                    )
                    skipped_count += 1
                    continue

                try:
                    group = Group.objects.get(name=group_name)

                    # Agregar usuario al grupo si no está ya
                    if not user.user_groups.filter(group=group).exists():
                        user.user_groups.create(group=group)
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓ {user.email}: {role_name} → {group_name}'
                            )
                        )
                        migrated_count += 1
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f'↻ {user.email}: Ya estaba en grupo {group_name}'
                            )
                        )

                except Group.DoesNotExist:
                    self.stdout.write(
                        self.style.ERROR(
                            f'✗ Grupo "{group_name}" no existe (usuario: {user.email})'
                        )
                    )
                    skipped_count += 1

            # Resumen
            self.stdout.write('\n' + '=' * 50)
            self.stdout.write(self.style.SUCCESS(f'Usuarios migrados: {migrated_count}'))
            self.stdout.write(self.style.WARNING(f'Usuarios omitidos: {skipped_count}'))
            self.stdout.write('=' * 50 + '\n')

            self.stdout.write(
                self.style.SUCCESS(
                    'Migración completada. Ahora ejecuta: python manage.py migrate users'
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error durante migración: {str(e)}')
            )
