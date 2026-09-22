#
# Modelos del modulo users.
# Aqui vive la data principal de personas y roles.
#

from django.db import models
from django.utils import timezone
from django.contrib.auth.models import (
    AbstractBaseUser,      # esqueleto de usuario: trae password y last_login
    PermissionsMixin,      # agrega is_superuser, groups y user_permissions
    BaseUserManager,       # clase base para crear nuestro "manager"
)


class Role(models.Model):
    # Rol para clasificar y controlar permisos de usuarios.
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=225, null=True, blank=True)  # Opcional segun diccionario

    def __str__(self):
        return self.name


class DocumentType(models.Model):
    # Tabla de tipos de documento (CC, TI, CE, etc).
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255, null=True, blank=True)  # Opcional segun diccionario

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    # Django EXIGE un manager con estos metodos cuando el User es custom.
    # Es el encargado de "fabricar" usuarios correctamente.
    def get_queryset(self):
        # Por defecto, el manager devuelve solo los usuarios activos (is_deleted=False).
        return super().get_queryset().filter(is_deleted=False)

    def create_user(self, email, password=None, **extra_fields):
        # Crea un usuario normal.
        if not email:
            raise ValueError("El email es obligatorio")
        email = self.normalize_email(email)        # pasa el dominio a minusculas
        user = self.model(email=email, **extra_fields)
        user.set_password(password)                # hashea la contrasena automaticamente
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        # Crea un superusuario (acceso total al admin).
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    # Registro principal de usuario con datos personales, contacto y acceso.
    # password y last_login los hereda de AbstractBaseUser.

    # --- Datos personales ---
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)

    document_type = models.ForeignKey(
        DocumentType,
        on_delete=models.RESTRICT,   # no se puede borrar un tipo si hay usuarios que lo usan
        null=True
    )
    document_number = models.CharField(max_length=20, unique=True, null=True, blank=True)

    # --- Fechas de vinculacion ---
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_instructor_planta = models.BooleanField(default=False, help_text="Indica si el usuario es instructor de planta.")

    # --- Contacto ---
    email = models.EmailField(unique=True, max_length=254)
    institutional_email = models.EmailField(unique=True, max_length=254, null=True, blank=True)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    second_phone_number = models.CharField(max_length=15, null=True, blank=True)
    address = models.CharField(max_length=100, null=True, blank=True)

    # --- Multimedia ---
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)

    # Cuentadante: persona responsable de responder por los materiales.
    # Si es True, aparece en los selectores de cuentadante del sistema.
    is_accountable = models.BooleanField(
        default=False,
        help_text="Indica si el usuario puede ser asignado como cuentadante de materiales.",
    )

    # --- Campos que Django necesita para el control de acceso ---
    is_active = models.BooleanField(default=True)   # si esta en False, no puede entrar
    deactivation_reason = models.TextField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)   # si puede entrar al panel /admin

    # Marca al superadministrador original del sistema.
    # Una vez marcado como True nunca puede revertirse a False desde la API.
    # Protege contra la eliminación accidental o malintencionada del único
    # superadmin garantizado del sistema.
    is_primary_admin = models.BooleanField(
        default=False,
        help_text=(
            "Indica si este usuario es el superadministrador primigenio del sistema. "
            "No se puede quitar, cambiar de grupo ni desactivar a través de la API."
        ),
    )

    # Obliga al usuario a cambiar la contraseña en el próximo inicio de sesión.
    # Se activa al crear la cuenta o reenviar credenciales temporales.
    must_change_password = models.BooleanField(
        default=False,
        help_text="Si es True, el usuario debe cambiar su contraseña antes de usar el sistema.",
    )

    # Autorización de tratamiento de datos personales (Ley 1581 de 2012,
    # Protección de Datos Personales). Se exige al crear el usuario y queda
    # registrada con fecha para auditoría. No se puede modificar por la API.
    data_consent = models.BooleanField(
        default=False,
        help_text="El titular autorizó el tratamiento de sus datos personales (Ley 1581 de 2012).",
    )
    data_consent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha y hora en que se otorgó la autorización.",
    )

    # --- Campos que Django necesita para el control de acceso ---
    is_deleted = models.BooleanField(default=False)  # si esta en True, no puede entrar y se oculta de la lista
    deleted_at = models.DateTimeField(null=True, blank=True)  # fecha de eliminacion logica
    
    # Conecta el manager de arriba con este modelo
    objects = UserManager()        # manager que devuelve solo los usuarios activos (is_deleted=False)
    all_objects = models.Manager()  # manager que devuelve todos los usuarios, incluso los borrados

    def soft_delete(self):
        # Elimina logica del usuario (no lo borra de la base de datos).
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.is_active = False  # Desactiva el usuario para que no pueda iniciar sesión
        self.save(update_fields=['is_deleted', 'deleted_at', 'is_active'])
    
    def restore(self):
        # Restaura un usuario eliminado logicamente.
        self.is_deleted = False
        self.deleted_at = None
        self.is_active = True  # Reactiva el usuario para que pueda iniciar sesión
        # BUG FIX: is_active debe incluirse en update_fields o el cambio nunca
        # se persiste en la base de datos y el usuario queda inactivo para siempre.
        self.save(update_fields=['is_deleted', 'deleted_at', 'is_active'])
    
    # El campo que se usa para iniciar sesion (en vez del username de Django)
    USERNAME_FIELD = "email"
    # Campos que se piden al crear un superusuario por consola (ademas de email y password)
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return f'{self.first_name} {self.last_name}'


class PasswordChangeOTP(models.Model):
    """
    Código OTP de un solo uso para confirmar el cambio de contraseña
    desde el perfil del usuario autenticado.

    Flujo:
      1. Usuario envía contraseña actual + nueva → POST /api/users/me/change-password/request/
         Se valida la contraseña actual, se genera este registro y se envía el
         código al correo del usuario.
      2. Usuario ingresa el código OTP → POST /api/users/me/change-password/confirm/
         con { otp_code } → se valida y se aplica el cambio.

    Seguridad:
      - El código se almacena como SHA-256 (nunca en claro).
      - Expira en 10 minutos.
      - Máximo 5 intentos fallidos antes de invalidarse.
      - Un OTP solo puede usarse una vez (used=True tras el primer uso correcto).
      - La nueva contraseña se guarda hasheada en pending_password_hash para no
        transmitirla de nuevo en el paso de confirmación.
    """
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="password_change_otps",
    )
    code_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 del código OTP. Nunca se almacena en claro.",
    )
    # Almacenamos el hash de la nueva contraseña para no pedirla otra vez en el
    # paso de confirmación (el usuario ya la escribió en el paso 1).
    pending_password_hash = models.CharField(
        max_length=128,
        help_text="Hash Django de la nueva contraseña. Se aplica al confirmar el OTP.",
    )
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    OTP_MAX_ATTEMPTS = 5
    OTP_TTL_MINUTES = 10

    class Meta:
        db_table = "password_change_otps"
        verbose_name = "OTP de cambio de contraseña"
        verbose_name_plural = "OTPs de cambio de contraseña"

    def __str__(self):
        return f"PasswordChangeOTP user={self.user_id} usado={self.used}"

    @property
    def is_valid(self):
        """False si ya fue usado, expiró o superó el límite de intentos."""
        return (
            not self.used
            and self.attempts < self.OTP_MAX_ATTEMPTS
            and timezone.now() < self.expires_at
        )


class BlacklistedToken(models.Model):
    """
    Tokens JWT que han sido invalidados explícitamente vía logout.
    Cuando un usuario cierra sesión, su token se almacena aquí hasta
    que expire, momento en que el management command cleanup_blacklisted_tokens
    lo elimina para mantener la tabla pequeña.
    """
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="SHA-256 del token JWT en crudo. Nunca se guarda el token completo."
    )
    expires_at = models.DateTimeField(
        help_text="Momento en que el token expira según su claim 'exp'. "
                  "Usado por el comando de limpieza para descartar entradas obsoletas."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blacklisted_tokens'
        verbose_name = 'Token en lista negra'
        verbose_name_plural = 'Tokens en lista negra'

    def __str__(self):
        return f"BlacklistedToken {self.token_hash[:16]}… expira {self.expires_at}"
