# Management command break-glass para MFA (Fase 7).
#
#   python manage.py mfa_reset <email>
#
# Desactiva el segundo factor y borra códigos de recuperación. Solo por
# consola (N4): nunca por API. Audita en consola, no en la bitácora web
# (el actor es el operador del servidor).

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Desactiva el MFA de un usuario (emergencia por celular perdido)."

    def add_arguments(self, parser):
        parser.add_argument("email", help="Correo del usuario.")

    def handle(self, *args, email, **options):
        from modules.users.mfa import backup_codes_remaining, mfa_device_for
        from modules.users.models import RecoveryCode, User

        try:
            user = User.all_objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"No existe el usuario {email}.")
        device = mfa_device_for(user)
        if device is None:
            self.stdout.write(f"{email} no tiene MFA activo. Nada que hacer.")
            return
        remaining = backup_codes_remaining(user)
        device.delete()
        RecoveryCode.objects.filter(user=user).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"MFA desactivado para {email} "
                f"({remaining} códigos eliminados). Deberá inscribir de nuevo."
            )
        )
