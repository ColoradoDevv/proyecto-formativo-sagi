# modules/users/utils.py
import secrets 
import string

from django.conf import settings

from sia_api.emailing import send_sagi_email

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
    send_sagi_email(
        user.email,
        subject="Código de verificación - Cambio de contraseña SAGI",
        template="password_change_otp.html",
        context={
            "greeting_name": user.first_name,
            "code": otp_code,
            "code_caption": "Válido por 10 minutos y de un solo uso.",
            "warning": "Si no solicitaste este cambio, ignora este correo. Tu contraseña actual no será modificada.",
        },
    )


def send_password_changed_confirmation_email(user):
    """
    Notifica al usuario que su contraseña fue cambiada exitosamente.
    Si no fue él, le indica cómo actuar.
    """
    send_sagi_email(
        user.email,
        subject="Tu contraseña fue cambiada - SAGI",
        template="password_changed.html",
        context={
            "greeting_name": user.first_name,
            "warning": "Si no realizaste este cambio, contacta al administrador del sistema de inmediato para proteger tu cuenta.",
        },
    )


def send_welcome_email(user, plain_password):
    """
    Envia al correo del usuario recien creado sus credenciales de acceso.
    Se usa la misma configuracion SMTP (Gmail) ya definida en settings.
    """
    send_sagi_email(
        user.email,
        subject="Bienvenido a SAGI - Tus credenciales de acceso",
        template="welcome.html",
        context={
            "greeting_name": user.first_name,
            "credentials": [
                ("Correo", user.email),
                ("Contraseña", plain_password),
            ],
            "button": {
                "label": "Iniciar sesión",
                "url": f"{settings.FRONTEND_URL}/login",
            },
            "warning": "Por seguridad, inicia sesión y cambia tu contraseña lo antes posible.",
        },
    )
