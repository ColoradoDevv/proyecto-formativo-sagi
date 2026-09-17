# Modelos del modulo loans (Prestamos).

from django.db import models
from django.conf import settings # para referenciar el modelo de usuario personalizado definido en settings.py
from modules.products.models import ConsumableMaterial  # FK a materiales de consumo Y devolutivos


class Loans(models.Model):

    # Estados del prestamo.
    # Pendiente: recien creado, esperando firma de ambas partes.
    # Activo:    ambas partes firmaron; el material ya fue entregado.
    # Finalizado/Incompleto: flujo de devolucion completado.
    STATE_CHOICES = [
        ('Pendiente', 'Pendiente'),
        ('Activo', 'Activo'),
        ('Finalizado', 'Finalizado'),
        ('Incompleto', 'Incompleto'),
    ]

    LOAN_TYPE = [
        ('Interno', 'Interno'),
        ('Externo', 'Externo')
    ]

    # id_loan: PK, AI, Único, obligatorio — Django lo genera automático con AutoField
    id_loan = models.AutoField(primary_key=True)

    # id_usuario: FK a tabla Usuario, obligatorio, sin valor por defecto
    id_responsable_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        db_column='id_responsable_user',
        related_name='prestamos_responsable',
        null=False
    )

    # Nulo cuando el receptor no está registrado en el sistema — en ese caso
    # se usa receptor_name/receptor_email en su lugar (ver propiedades
    # receptor_display_name/receptor_contact_email/is_receptor_external).
    id_receptor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        db_column='id_receptor_user',
        related_name='prestamos_recibidos',
        null=True,
        blank=True,
    )
    receptor_name = models.CharField(max_length=150, null=True, blank=True)
    receptor_email = models.EmailField(null=True, blank=True)

    # ── Agrupación de préstamos por lote ────────────────────────────────
    # Cuando se crean varios préstamos en la misma transacción (multi-material),
    # todos comparten el mismo batch_id. Esto permite emitir un único token de
    # firma y un único OTP por rol que cubre todo el lote.
    # Los préstamos de un solo material también reciben un batch_id propio
    # para mantener la lógica uniforme.
    batch_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text='UUID compartido por todos los préstamos del mismo lote de creación.',
    )

    # id_material: FK a Materiales (consumo Y devolutivos), obligatorio
    # Apunta a ConsumableMaterial porque Returnable_material hereda de ella
    id_material = models.ForeignKey(
        ConsumableMaterial,
        on_delete=models.RESTRICT,
        db_column='id_material',
        null=False
    )

    # amount_lent: entero 0-999999, obligatorio, sin PK ni FK
    amount_lent = models.IntegerField(
        null=False,
        default=None  # obligatorio, sin valor por defecto real
    )

    # apprentice_group: alfanumérico solo números, max 10, obligatorio
    apprentice_group = models.CharField(
        max_length=10,
        null=False
    )

    # justification_use: texto alfanumérico, max 255, obligatorio
    justification_use = models.CharField(   # respetando el typo del diccionario
        max_length=255,
        null=False
    )

    # return_date: fecha programada de devolución, default hoy, obligatorio
    return_date = models.DateField(
        null=False,
        default=models.fields.datetime.date.today  # CURRENT_TIMESTAMP equivalente en fecha
    )

    # loan_date: fecha de inicio del préstamo, default hoy, obligatorio
    loan_date = models.DateField(
        null=False,
        auto_now_add=True   # se llena automático al crear, equivale a CURRENT_TIMESTAMP
    )

    # state: estado del prestamo.
    # Nace en 'Pendiente'; pasa a 'Activo' cuando ambas partes firman;
    # luego a 'Finalizado' o 'Incompleto' al registrar la devolucion.
    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default='Pendiente',
    )

    # loan_type: clasificación del préstamo (Interno/Externo), independiente
    # del ciclo de vida en `state`.
    loan_type = models.CharField(
        max_length=20,
        choices=LOAN_TYPE,
        default='Interno',
    )

    # ── Trazabilidad de firma electrónica ────────────────────────────────
    # Quién firmó y cuándo.  null=True porque al crear el préstamo aún no
    # hay firma; se rellenan conforme cada parte confirma.

    signed_by_responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='firmas_responsable',
        help_text='Usuario que firmó como responsable del préstamo.',
    )
    signed_at_responsable = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Fecha y hora en que el responsable firmó.',
    )

    signed_by_receptor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='firmas_receptor',
        help_text='Usuario que firmó como receptor del préstamo.',
    )
    signed_at_receptor = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Fecha y hora en que el receptor firmó.',
    )

    signed_ip_responsable = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP desde la que firmó el responsable.',
    )
    signed_ua_responsable = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text='User-Agent del navegador al firmar (responsable).',
    )
    signed_ip_receptor = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP desde la que firmó el receptor.',
    )
    signed_ua_receptor = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text='User-Agent del navegador al firmar (receptor).',
    )

    class Meta:
        db_table = 'Prestamos'

    def __str__(self):
        return f'Prestamo {self.id_loan} - Responsable {self.id_responsable_user_id} - Receptor {self.id_receptor_user_id} - Material {self.id_material_id}'

    @property
    def both_signed(self):
        """True cuando ambas partes ya firmaron.

        Se usa el timestamp (signed_at_*) y no la FK (signed_by_*): un
        receptor externo nunca tiene signed_by_receptor poblado (no hay
        User al que apuntar), pero sí queda su signed_at_receptor.
        """
        return self.signed_at_responsable is not None and self.signed_at_receptor is not None

    @property
    def is_receptor_external(self):
        """True cuando el receptor no es un usuario registrado del sistema."""
        return self.id_receptor_user_id is None

    @property
    def receptor_display_name(self):
        if self.id_receptor_user_id:
            return f"{self.id_receptor_user.first_name} {self.id_receptor_user.last_name}"
        return self.receptor_name or self.receptor_email

    @property
    def receptor_contact_email(self):
        return self.id_receptor_user.email if self.id_receptor_user_id else self.receptor_email


class LoanDraft(models.Model):
    """
    Borrador de préstamo: almacena los datos antes de que se cree el préstamo real.
    El préstamo (Loans) solo se crea cuando ambas partes firman el borrador.

    Ciclo de vida:
      1. POST /api/loans/draft/  → se crea este registro, se envían correos de firma.
      2. Cada parte firma via /api/loans/draft/sign/ (token JWT + OTP).
      3. Cuando both_signed == True → se crea el Loans real y este borrador
         pasa a state='committed' (ya no se necesita, pero se conserva para auditoría).
      4. Borradores en state='pending' que no se firman en DRAFT_TTL_HOURS horas
         se pueden limpiar periódicamente sin dejar basura en Loans.
    """

    STATE_PENDING   = 'pending'
    STATE_COMMITTED = 'committed'
    STATE_EXPIRED   = 'expired'
    STATE_CHOICES   = [
        (STATE_PENDING,   'Pendiente de firma'),
        (STATE_COMMITTED, 'Comprometido (Loans creado)'),
        (STATE_EXPIRED,   'Expirado'),
    ]

    DRAFT_TTL_HOURS = 24   # borradores sin firmar expiran en 24 h

    # UUID compartido por todos los borradores del mismo lote (multi-material).
    batch_id = models.UUIDField(db_index=True)

    # Datos del préstamo (espejo de Loans, sin las firmas).
    id_responsable_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='draft_prestamos_responsable',
    )
    # Nulo cuando el receptor no está registrado — ver receptor_name/
    # receptor_email y las propiedades espejo de Loans.
    id_receptor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='draft_prestamos_recibidos',
        null=True,
        blank=True,
    )
    receptor_name = models.CharField(max_length=150, null=True, blank=True)
    receptor_email = models.EmailField(null=True, blank=True)
    id_material = models.ForeignKey(
        'products.ConsumableMaterial',
        on_delete=models.CASCADE,
        related_name='loan_drafts',
    )
    amount_lent       = models.IntegerField()
    apprentice_group  = models.CharField(max_length=10)
    justification_use = models.CharField(max_length=255)
    return_date       = models.DateField()
    loan_date         = models.DateField(auto_now_add=True)

    # Misma clasificación que Loans.loan_type — se copia al Loans real al
    # comprometer el borrador (ver LoanDraftSignView).
    loan_type = models.CharField(max_length=20, choices=[('Interno', 'Interno'), ('Externo', 'Externo')], default='Interno')

    state = models.CharField(max_length=20, choices=STATE_CHOICES, default=STATE_PENDING)

    # Firma del responsable.
    signed_by_responsable  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='draft_firmas_responsable',
    )
    signed_at_responsable  = models.DateTimeField(null=True, blank=True)
    signed_ip_responsable  = models.GenericIPAddressField(null=True, blank=True)
    signed_ua_responsable  = models.CharField(max_length=500, null=True, blank=True)

    # Firma del receptor.
    signed_by_receptor  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='draft_firmas_receptor',
    )
    signed_at_receptor  = models.DateTimeField(null=True, blank=True)
    signed_ip_receptor  = models.GenericIPAddressField(null=True, blank=True)
    signed_ua_receptor  = models.CharField(max_length=500, null=True, blank=True)

    # ID del Loans creado al comprometer (para trazabilidad).
    committed_loan_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text='Momento en que el borrador expira si no se firma.',
    )

    class Meta:
        db_table = 'loan_drafts'

    def __str__(self):
        return f'LoanDraft batch={str(self.batch_id)[:8]} material={self.id_material_id} state={self.state}'

    @property
    def both_signed(self):
        # Ver el comentario equivalente en Loans.both_signed: se usa el
        # timestamp, no la FK, porque un receptor externo nunca tiene
        # signed_by_receptor poblado.
        return (
            self.signed_at_responsable is not None
            and self.signed_at_receptor is not None
        )

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() >= self.expires_at

    @property
    def is_receptor_external(self):
        return self.id_receptor_user_id is None

    @property
    def receptor_display_name(self):
        if self.id_receptor_user_id:
            return f"{self.id_receptor_user.first_name} {self.id_receptor_user.last_name}"
        return self.receptor_name or self.receptor_email

    @property
    def receptor_contact_email(self):
        return self.id_receptor_user.email if self.id_receptor_user_id else self.receptor_email


class SignOTP(models.Model):
    """
    Código OTP de un solo uso para confirmar la firma electrónica de un préstamo.

    Flujo:
      1. Usuario abre el enlace del correo → ya autenticado → frontend llama
         POST /api/loans/sign/request-otp/  → se genera este registro y se
         envía el código al correo del usuario.
      2. Usuario ingresa el código → frontend llama POST /api/loans/sign/
         con { token, otp_code } → se valida y se registra la firma.

    Seguridad:
      - El código se almacena como SHA-256 (nunca en claro).
      - Expira en 10 minutos.
      - Máximo 5 intentos fallidos antes de invalidarse (attempts).
      - Un OTP solo puede usarse una vez (used=True tras el primer uso correcto).
    """
    loan = models.ForeignKey(
        Loans,
        on_delete=models.CASCADE,
        related_name='otps',
        help_text='Préstamo representativo del lote al que pertenece este OTP.',
    )
    # Cuando el OTP cubre un lote completo este campo almacena el UUID del lote.
    # Para préstamos individuales también se rellena (batch_id == loan.batch_id).
    batch_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text='UUID del lote de préstamos que cubre este OTP.',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sign_otps',
        help_text='Usuario que debe ingresar el código.',
    )
    role = models.CharField(
        max_length=20,
        help_text="'responsable' o 'receptor'.",
    )
    code_hash = models.CharField(
        max_length=64,
        help_text='SHA-256 del código OTP. Nunca se almacena en claro.',
    )
    expires_at = models.DateTimeField(
        help_text='Momento en que el OTP deja de ser válido.',
    )
    used = models.BooleanField(
        default=False,
        help_text='True una vez que el código fue verificado correctamente.',
    )
    attempts = models.PositiveSmallIntegerField(
        default=0,
        help_text='Intentos fallidos acumulados. Al llegar a 5 se invalida.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    OTP_MAX_ATTEMPTS = 5
    OTP_TTL_MINUTES  = 10

    class Meta:
        db_table = 'loan_sign_otps'
        verbose_name = 'OTP de firma'
        verbose_name_plural = 'OTPs de firma'

    def __str__(self):
        return f'OTP préstamo {self.loan_id} / {self.role} — usado={self.used}'

    @property
    def is_valid(self):
        """False si ya fue usado, expiró o superó el límite de intentos."""
        from django.utils import timezone
        return (
            not self.used
            and self.attempts < self.OTP_MAX_ATTEMPTS
            and timezone.now() < self.expires_at
        )
