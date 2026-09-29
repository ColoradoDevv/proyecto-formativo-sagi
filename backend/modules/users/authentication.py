#
# Autenticacion por JWT para el modulo users.
# Se ejecuta en cada peticion: lee el token y carga el usuario.
#

import hashlib
import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User, BlacklistedToken


class JWTAuthentication(BaseAuthentication):
    # DRF llama a este metodo automaticamente en cada peticion.
    def authenticate_header(self, request):
        # Sin esto DRF responde 403 ante AuthenticationFailed y el frontend
        # (que cierra la sesión solo con 401) nunca mostraría el aviso.
        return "Bearer"

    def authenticate(self, request):
        # 1. Buscar el header "Authorization: Bearer <token>"
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None   # sin token -> peticion anonima (no error)

        # 2. Separar el token del prefijo "Bearer "
        token = auth_header.split(" ")[1]

        # 3. Verificar y decodificar el token
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("El token ha expirado")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Token invalido")

        # 3b. Alcance del token: los tokens de reset/firma usan la misma
        # clave pero NO son sesiones (sin scope = login anterior a esta
        # regla, se acepta por compatibilidad).
        if payload.get("scope") is not None and payload.get("scope") != "session":
            raise AuthenticationFailed("Token no válido para esta operación")

        # 4. Verificar que el token no haya sido revocado (logout)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if BlacklistedToken.objects.filter(token_hash=token_hash).exists():
            raise AuthenticationFailed("El token ha sido revocado. Inicia sesión nuevamente.")

        # 5. Buscar al usuario que dice el token.
        # Usamos all_objects (manager sin filtro) para encontrar también usuarios
        # con soft-delete: si el token es válido pero el usuario está eliminado/inactivo
        # queremos dar un error claro en vez de "no encontrado".
        try:
            user = User.all_objects.get(id=payload["user_id"])
        except User.DoesNotExist:
            raise AuthenticationFailed("Usuario no encontrado")

        if user.is_deleted:
            raise AuthenticationFailed("Esta cuenta ha sido eliminada")

        if not user.is_active:
            raise AuthenticationFailed("Esta cuenta estǭ desactivada")

        # 6. Sesión única: el token debe ser el de la sesión activa.
        # Si el usuario inició sesión en otra ventana/dispositivo después,
        # este token quedó reemplazado y se rechaza sin recargar nada en el
        # cliente (el frontend muestra el aviso y cierra esta sesión).
        # active_session_jti None = login anterior a esta regla: se permite
        # hasta el próximo login, que ya registrará su jti.
        if user.active_session_jti is not None and payload.get("jti") != user.active_session_jti:
            raise AuthenticationFailed(
                "Se inició sesión en otro dispositivo o ventana. "
                "Esta sesión fue cerrada por seguridad."
            )

        # 7. Devolver el usuario -> DRF lo pone en request.user
        return (user, None)