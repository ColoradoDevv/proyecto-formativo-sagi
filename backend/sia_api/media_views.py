# Servidor de archivos multimedia con autenticación.
#
# Por defecto Django (runserver) y la mayoría de servidores estáticos sirven
# /media/* a cualquiera con la URL: fotos, fichas y cotizaciones contienen
# datos personales (Ley 1581 de 2012) y no pueden ser públicos.
# Esta vista exige sesión (JWT) y protege contra path traversal.
# Va ANTES del helper static() en sia_api/urls.py para que siempre gane.
import mimetypes
from pathlib import Path
from urllib.parse import unquote

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.views import APIView

from modules.users.authentication import JWTAuthentication


class QueryParamJWTAuthentication(JWTAuthentication):
    """Igual que JWTAuthentication, pero también acepta `?auth=<jwt>`.

    Los <img> y <a> del navegador no pueden mandar el header Authorization,
    así que el frontend propaga el token por query (ver mediaUrl()).
    El token se valida igual: firma, expiración, blacklist y cuenta activa.
    """

    def authenticate(self, request):
        # OJO: no leer request.headers antes de inyectar, porque HttpRequest
        # cachea los headers en el primer acceso e ignoraría el META nuevo.
        if "HTTP_AUTHORIZATION" not in request.META:
            raw = request.query_params.get("auth")
            if raw:
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {raw}"
        return super().authenticate(request)


def _is_registered_media(rel_posix: str) -> bool:
    """True si `rel_posix` (ej. "quotes/abc.pdf") está referenciado por algún
    registro: cotización, ficha, foto/ficha de material o foto de perfil."""
    from django.db.models import Q
    from modules.products.models import Quotation, TechnicalSheet, ConsumableMaterial
    from modules.users.models import User

    if Quotation.objects.filter(file=rel_posix).exists():
        return True
    if TechnicalSheet.objects.filter(file=rel_posix).exists():
        return True
    if ConsumableMaterial.objects.filter(
        Q(image=rel_posix) | Q(technical_sheet=rel_posix)
    ).exists():
        return True
    return User.all_objects.filter(profile_picture=rel_posix).exists()


class AuthenticatedMediaView(APIView):
    """GET /media/<path> — solo usuarios autenticados."""

    authentication_classes = [QueryParamJWTAuthentication]

    # Sin get_permissions(): aplican los globales (IsAuthenticated +
    # NotBlockedByPasswordChange). Receptor externo sin cuenta: sus enlaces
    # de firma/OTP no necesitan archivos, así que no se le deja pasar.

    def get(self, request, path):
        from django.core.exceptions import SuspiciousFileOperation
        from django.utils._os import safe_join

        base = Path(settings.MEDIA_ROOT).resolve()
        try:
            raw_path = unquote(path)
            relative_path = Path(raw_path)
            if relative_path.is_absolute() or ".." in relative_path.parts:
                raise Http404()
            # safe_join aborta si la ruta escapa de base (sanitizador
            # reconocido: además del chequeo manual de arriba).
            joined = safe_join(str(base), raw_path)
        except (ValueError, RuntimeError, SuspiciousFileOperation):
            raise Http404()
        target = Path(joined)
        if target != base and base not in target.parents:
            raise Http404()
        if not target.is_file():
            raise Http404()
        # Solo se sirven archivos registrados en la BD (fotos, fichas,
        # cotizaciones): un archivo huérfano en disco no es alcanzable
        # aunque se adivine su URL.
        rel_posix = target.relative_to(base).as_posix()
        if not _is_registered_media(rel_posix):
            raise Http404()
        content_type, _ = mimetypes.guess_type(str(target))
        response = FileResponse(
            open(target, "rb"),
            content_type=content_type or "application/octet-stream",
        )
        # Evita que el navegador "adivine" el tipo (XSS via MIME sniffing).
        # Los SVG se rechazan en la subida, así que no hay scripts que ejecutar.
        response["X-Content-Type-Options"] = "nosniff"
        # Inline (no attachment) para que PDFs e imágenes se previsualicen.
        response["Content-Disposition"] = f'inline; filename="{target.name}"'
        return response
