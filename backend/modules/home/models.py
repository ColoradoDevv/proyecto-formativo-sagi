from django.db import models

# Create your models here.


class SiteSetting(models.Model):
    """Ajustes globales del sistema en clave-valor (ej. correo de soporte).

    Se editan desde la interfaz (solo superusuario) para no hardcodear
    valores en el código.
    """

    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    SUPPORT_EMAIL_KEY = "support_email"

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} = {self.value}"

    @classmethod
    def get_support_email(cls):
        """Correo de soporte vigente (o el remitente del sistema por defecto)."""
        from django.conf import settings

        stored = cls.objects.filter(key=cls.SUPPORT_EMAIL_KEY).first()
        if stored and stored.value.strip():
            return stored.value.strip()
        return getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""

