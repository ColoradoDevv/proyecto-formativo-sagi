from django.apps import AppConfig


class AuditConfig(AppConfig):
    name = "modules.audit"
    verbose_name = "Auditoría"

    def ready(self):
        # Conectar las señales al arrancar la aplicación.
        import modules.audit.signals  # noqa: F401
