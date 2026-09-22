# Purga de registros de auditoría antiguos (Ley 1581 de 2012: los datos
# personales —nombres, correos, IPs en los logs— solo se conservan el
# tiempo necesario para las finalidades de trazabilidad de la entidad).
#
# Uso:
#   python manage.py purge_audit_logs               # borra > 730 días
#   python manage.py purge_audit_logs --days 365
#   python manage.py purge_audit_logs --days 365 --dry-run
#
# Recomendado: programarlo (cron / tarea de Supabase) con la periodicidad
# que definan las tablas de retención documental (TRD) del centro.
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from modules.audit.models import AuditLog


class Command(BaseCommand):
    help = "Elimina registros de auditoría anteriores a N días (defecto: 730)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=730,
            help="Antigüedad mínima en días para purgar (defecto: 730).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo informa cuántos registros se borrarían, sin borrar.",
        )

    def handle(self, *args, days, dry_run, **options):
        if days < 30:
            self.stderr.write("Por seguridad, --days debe ser al menos 30.")
            return
        cutoff = timezone.now() - datetime.timedelta(days=days)
        qs = AuditLog.objects.filter(timestamp__lt=cutoff)
        count = qs.count()
        if dry_run:
            self.stdout.write(f"[dry-run] Se borrarían {count} registros anteriores a {cutoff.date()}.")
            return
        deleted, _ = qs.delete()
        self.stdout.write(f"Se purgaron {deleted} registros anteriores a {cutoff.date()}.")
