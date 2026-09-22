# Validación server-side de archivos subidos (defensa en profundidad: el
# frontend ya valida tipo/tamaño, pero eso se burla con un curl).
# Se usa de dos formas:
#   1. Como validators=[...] en serializer fields (DRF convierte el
#      DjangoValidationError en error 400 del campo).
#   2. Como validate_image_upload()/validate_sheet_upload() en vistas que
#      leen request.FILES directamente (lanzan DRF ValidationError con
#      forma {"campo": "mensaje"}).
import os

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}
IMAGE_MAX_MB = 2

SHEET_EXTENSIONS = {"pdf", "xlsx", "png"}
SHEET_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
}
SHEET_MAX_MB = 3


def _check(upload, allowed_ext, allowed_mime, max_mb, field):
    """Lanza DjangoValidationError si el archivo no cumple. `upload` es un
    UploadedFile de request.FILES (tiene .size, .name y .content_type)."""
    if upload is None or upload == "":
        return
    name = getattr(upload, "name", "") or ""
    ext = os.path.splitext(name)[1].lower().lstrip(".")
    if ext not in allowed_ext:
        raise DjangoValidationError(
            f"Formato no permitido (.{ext or '?'}). Permitidos: "
            + ", ".join(f".{e}" for e in sorted(allowed_ext))
            + "."
        )
    content_type = getattr(upload, "content_type", "") or ""
    if content_type and content_type not in allowed_mime:
        raise DjangoValidationError(
            f"Tipo de contenido no permitido ({content_type})."
        )
    size = getattr(upload, "size", 0) or 0
    if size > max_mb * 1024 * 1024:
        raise DjangoValidationError(
            f"El archivo supera el tamaño máximo de {max_mb}MB."
        )
    # Verificación real de imagen con Pillow: detecta archivos con
    # extensión válida pero contenido corrupto o malicioso.
    if allowed_mime == IMAGE_MIME_TYPES and hasattr(upload, "seek"):
        from PIL import Image
        try:
            pos = upload.tell() if hasattr(upload, "tell") else None
            with Image.open(upload) as img:
                img.verify()
            if pos is not None:
                upload.seek(pos)
        except Exception:
            raise DjangoValidationError("El archivo no es una imagen válida.")


def validate_image_file(upload):
    """Validador para serializer fields (foto de material/perfil)."""
    _check(upload, IMAGE_EXTENSIONS, IMAGE_MIME_TYPES, IMAGE_MAX_MB, "image")


def validate_sheet_file(upload):
    """Validador para serializer fields (ficha técnica)."""
    _check(upload, SHEET_EXTENSIONS, SHEET_MIME_TYPES, SHEET_MAX_MB, "technical_sheet")


QUOTATION_EXTENSIONS = {"pdf"}
QUOTATION_MIME_TYPES = {"application/pdf"}
QUOTATION_MAX_MB = 3
QUOTATION_MAX_FILES = 3


def validate_quotation_file(upload):
    """Validador para serializer fields (cotización: solo PDF)."""
    _check(upload, QUOTATION_EXTENSIONS, QUOTATION_MIME_TYPES, QUOTATION_MAX_MB, "quotations")


def _as_drf(field, func, upload):
    if upload is None or upload == "":
        return
    try:
        func(upload)
    except DjangoValidationError as exc:
        raise DRFValidationError({field: exc.messages})


def validate_image_upload(upload, field="image"):
    """Para vistas con request.FILES directo. Lanza DRF 400 si no cumple."""
    _as_drf(field, validate_image_file, upload)


def validate_sheet_upload(upload, field="technical_sheet"):
    """Para vistas con request.FILES directo. Lanza DRF 400 si no cumple."""
    _as_drf(field, validate_sheet_file, upload)


def validate_quotation_upload(upload, field="quotations"):
    """Para vistas con request.FILES directo. Lanza DRF 400 si no cumple."""
    _as_drf(field, validate_quotation_file, upload)
