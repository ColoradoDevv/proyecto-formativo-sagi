#
# Management command para eliminar tokens expirados de la blacklist.
#
# Uso:
#   python manage.py cleanup_blacklisted_tokens
#
# Se recomienda programarlo como tarea periódica (cron / celery beat)
# para que la tabla no crezca indefinidamente. Una frecuencia razonable
# es cada hora o al inicio del día.
#

from django.core.management.base import BaseCommand
from django.utils import timezone
from modules.users.models import BlacklistedToken


class Command(BaseCommand):
    help = "Elimina de la blacklist los tokens JWT que ya han expirado."

    def handle(self, *args, **options):
        now = timezone.now()
        deleted_count, _ = BlacklistedToken.objects.filter(expires_at__lt=now).delete()

        if deleted_count:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Se eliminaron {deleted_count} token(s) expirado(s) de la blacklist."
                )
            )
        else:
            self.stdout.write("No había tokens expirados en la blacklist.")
