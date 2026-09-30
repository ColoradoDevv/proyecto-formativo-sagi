#
# Segundo factor TOTP (Fase 7 del sistema dinámico de roles).
#
# - Secreto cifrado en reposo (Fernet + MFA_ENCRYPTION_KEY).
# - Login en 2 pasos: token temporal scope=mfa (5 min, sin acceso a la API)
#   y luego código de app autenticadora o código de recuperación.
# - Obligatorio para Primigenio, superusuarios y niveles <= 200
#   (SADMIN/ADMIN); opcional para el resto.
#

import base64
import datetime
import io
import os
import secrets
import uuid

import jwt
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import MFADevice, RecoveryCode

MFA_TOKEN_TTL_MINUTES = 5
RECOVERY_CODE_COUNT = 10
TOTP_VALID_WINDOW = 1
MFA_ISSUER_NAME = "SAGI-SENA"


def get_fernet():
    """Fernet con la llave dedicada. Falla claro si falta (no degradar)."""
    key = os.getenv("MFA_ENCRYPTION_KEY", "")
    if not key:
        raise ImproperlyConfigured(
            "MFA_ENCRYPTION_KEY no está configurada. Genera una con: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode())
    except Exception:
        raise ImproperlyConfigured("MFA_ENCRYPTION_KEY inválida (debe ser llave Fernet).")


def encrypt_secret(plain_secret):
    return get_fernet().encrypt(plain_secret.encode()).decode()


def decrypt_secret(device):
    try:
        return get_fernet().decrypt(device.secret_encrypted.encode()).decode()
    except InvalidToken:
        raise ImproperlyConfigured(
            "No se pudo descifrar el secreto MFA (¿cambió MFA_ENCRYPTION_KEY?)."
        )


def mfa_required_for(user):
    """True si el usuario debe pasar segundo factor en cada login."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_primary_admin", False) or getattr(user, "is_superuser", False):
        return True
    from modules.permissions.services import PermissionService

    level = PermissionService.effective_level(user)
    return level is not None and level <= 200


def mfa_device_for(user):
    try:
        return user.mfa_device
    except MFADevice.DoesNotExist:
        return None


def issue_mfa_token(user, enroll_required=False):
    """Token temporal scope=mfa (5 min). No da acceso a la API."""
    payload = {
        "user_id": user.id,
        "email": user.email,
        "scope": "mfa",
        "enroll_required": enroll_required,
        "jti": uuid.uuid4().hex,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=MFA_TOKEN_TTL_MINUTES),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


class MfaTempAuthentication(BaseAuthentication):
    """Solo tokens temporales scope=mfa. Sin sesión única ni blacklist
    (viven 5 min); cualquier otro token se rechaza aquí mismo."""

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("El paso de verificación expiró. Inicia sesión de nuevo.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Token inválido")
        if payload.get("scope") != "mfa" or "user_id" not in payload:
            raise AuthenticationFailed("Token no válido para esta operación")
        from .models import User

        try:
            user = User.all_objects.get(id=payload["user_id"])
        except User.DoesNotExist:
            raise AuthenticationFailed("Usuario no encontrado")
        if user.is_deleted or not user.is_active:
            raise AuthenticationFailed("Cuenta no disponible")
        return (user, None)

    def authenticate_header(self, request):
        return "Bearer"


class MfaEnrollAuthentication(BaseAuthentication):
    """Inscripción: token temporal mfa O sesión completa.

    Marca request.mfa_temp (True/False) para que la vista sepa si debe
    exigir la contraseña (sesión) o no (temporal recién logueado).
    """

    def authenticate(self, request):
        try:
            result = MfaTempAuthentication().authenticate(request)
        except Exception:
            result = None
        if result is not None:
            request.mfa_temp = True
            return result
        from modules.users.authentication import JWTAuthentication

        result = JWTAuthentication().authenticate(request)
        if result is not None:
            request.mfa_temp = False
            return result
        return None

    def authenticate_header(self, request):
        return "Bearer"


def new_totp_secret():
    import pyotp

    return pyotp.random_base32()


def provisioning_uri(secret, email):
    import pyotp

    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=MFA_ISSUER_NAME)


def qr_png_data_uri(otpauth_uri):
    """QR en data URI PNG (el frontend lo muestra sin dependencias)."""
    import qrcode

    buffer = io.BytesIO()
    qrcode.make(otpauth_uri).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def verify_totp_code(user, code):
    """Valida el código contra el secreto (puro: no exige habilitado;
    cada vista decide si el dispositivo debe estar activo)."""
    import pyotp
    from django.utils import timezone

    device = mfa_device_for(user)
    if device is None:
        return False
    secret = decrypt_secret(device)
    ok = pyotp.TOTP(secret).verify(str(code).strip(), valid_window=TOTP_VALID_WINDOW)
    if ok:
        device.last_used_at = timezone.now()
        device.save(update_fields=["last_used_at"])
    return ok


def generate_recovery_codes(user):
    """Crea 10 códigos nuevos (invalida los anteriores sin usar). Retorna los planos UNA vez."""
    from django.contrib.auth.hashers import make_password

    RecoveryCode.objects.filter(user=user, used=False).update(used=True)
    plain_codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = secrets.token_hex(4).upper()
        code = f"{raw[:4]}-{raw[4:]}"
        plain_codes.append(code)
        RecoveryCode.objects.create(user=user, code_hash=make_password(code))
    return plain_codes


def consume_recovery_code(user, code):
    """Verifica y quema un código de recuperación. True si era válido."""
    from django.contrib.auth.hashers import check_password

    wanted = (code or "").strip().upper()
    if not wanted:
        return False
    for recovery in RecoveryCode.objects.filter(user=user, used=False):
        if check_password(wanted, recovery.code_hash):
            recovery.used = True
            recovery.save(update_fields=["used"])
            return True
    return False


def backup_codes_remaining(user):
    return RecoveryCode.objects.filter(user=user, used=False).count()
