# modules/users/utils.py
import secrets 
import string

from django.conf import settings
from django.core.mail import send_mail

def generate_secure_password(length=12):
    """
    Genera una contraseña aleatoria criptograficamente segura que cumple
    la misma politica de complejidad usada en ResetPasswordView:
    minimo 10 caracteres, mayuscula, minuscula, numero y caracter especial.
    """
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special = "!@#$%^&*()-_=+"

    # Garantizamos al menos un caracter de cada tipo exigido por la politica
    required_chars = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    all_chars = lowercase + uppercase + digits + special
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required_chars))]

    password_chars = required_chars + remaining
    secrets.SystemRandom().shuffle(password_chars)  # evita que los tipos queden en orden fijo

    return "".join(password_chars)

def send_password_change_otp_email(user, otp_code):
    """
    Envía el código OTP al correo del usuario para confirmar el cambio
    de contraseña iniciado desde su perfil.
    """
    send_mail(
        subject="Código de verificación - Cambio de contraseña SAGI",
        message=(
            "SAGI · Sistema Administrativo de Gestión de Inventarios — SENA\n\n"
            f"Hola {user.first_name},\n\n"
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta en SAGI.\n\n"
            f"Tu código de verificación es:\n\n"
            f"    {otp_code}\n\n"
            "Este código es válido por 10 minutos y solo puede usarse una vez.\n\n"
            "Si no solicitaste este cambio, ignora este correo. "
            "Tu contraseña actual no será modificada."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_changed_confirmation_email(user):
    """
    Notifica al usuario que su contraseña fue cambiada exitosamente.
    Si no fue él, le indica cómo actuar.
    """
    send_mail(
        subject="Tu contraseña fue cambiada - SAGI",
        message=(
            "SAGI · Sistema Administrativo de Gestión de Inventarios — SENA\n\n"
            f"Hola {user.first_name},\n\n"
            "Te confirmamos que la contraseña de tu cuenta en SAGI fue cambiada exitosamente.\n\n"
            "Si no realizaste este cambio, contacta al administrador del sistema "
            "de inmediato para proteger tu cuenta.\n\n"
            f"Puedes iniciar sesión aquí: {settings.FRONTEND_URL}/login"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_welcome_email(user, plain_password):
    """
    Envia al correo del usuario recien creado sus credenciales de acceso.
    Se usa la misma configuracion SMTP (Gmail) ya definida en settings.
    """
    send_mail(
        subject="Bienvenido a SAGI - Tus credenciales de acceso",
        message=(
            "SAGI · Sistema Administrativo de Gestión de Inventarios — SENA\n\n"
            f"Hola {user.first_name},\n\n"
            "Se ha creado una cuenta para ti en el sistema SAGI.\n"
            "Estas son tus credenciales de acceso:\n\n"
            f"Correo: {user.email}\n"
            f"Contraseña: {plain_password}\n\n"
            "Por seguridad, te recomendamos iniciar sesión y cambiar tu contraseña "
            "lo antes posible desde la opción 'Olvidé mi contraseña'.\n\n"
            f"Inicia sesión aquí: {settings.FRONTEND_URL}/login"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
