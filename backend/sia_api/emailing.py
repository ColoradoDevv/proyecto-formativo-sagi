# Sistema central de correos SAGI.
#
# Todos los correos salen con la misma plantilla HTML profesional
# (templates/emails/*.html — colores del software + logo del SENA) y su
# versión en texto plano como respaldo. El logo viaja incrustado (CID),
# así no depende de URLs externas que los clientes suelen bloquear.
#
# Para cambiar el diseño edita templates/emails/base.html y los parciales
# (_button, _code, _materials, _details, _credentials, _warning). Cada
# correo tiene su propio HTML en templates/emails/.

from email.mime.image import MIMEImage
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

LOGO_PATH = Path(__file__).resolve().parent / "email_assets" / "logo-sena-blanco.png"
LOGO_CID = "logo_sena"


def build_text_body(context):
    """Versión en texto plano del correo (respaldo + accesibilidad)."""
    lines = ["SAGI · Sistema Administrativo de Gestión de Inventarios — SENA", ""]
    name = (context.get("greeting_name") or "").strip()
    lines += [f"Hola{name and ', ' + name},", ""]
    for p in context.get("paragraphs", []):
        lines += [str(p), ""]
    if context.get("code"):
        lines += [f"Código: {context['code']}"]
        if context.get("code_caption"):
            lines.append(str(context["code_caption"]))
        lines.append("")
    button = context.get("button")
    if button:
        lines += [f"{button['label']}: {button['url']}", ""]
    if context.get("materials"):
        lines.append(str(context.get("materials_title") or "Materiales") + ":")
        lines += [f"  • {n} — cantidad: {q}" for n, q in context["materials"]]
        lines.append("")
    for label, value in context.get("details", []):
        lines.append(f"{label}: {value}")
    if context.get("details"):
        lines.append("")
    for label, value in context.get("credentials", []):
        lines.append(f"{label}: {value}")
    if context.get("credentials"):
        lines.append("")
    if context.get("warning"):
        lines += [str(context["warning"]), ""]
    return "\n".join(lines).strip() + "\n"


def send_sagi_email(to_email, subject, template, context):
    """Renderiza templates/emails/<template> y lo envía (texto + HTML con logo).

    Mantiene fail_silently=False como el resto del sistema.
    """
    full_context = {
        "frontend_url": getattr(settings, "FRONTEND_URL", "") or "",
        **(context or {}),
    }
    html_body = render_to_string(f"emails/{template}", full_context)
    text_body = build_text_body(full_context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    message.attach_alternative(html_body, "text/html")
    try:
        with open(LOGO_PATH, "rb") as logo_file:
            logo = MIMEImage(logo_file.read())
        logo.add_header("Content-ID", f"<{LOGO_CID}>")
        logo.add_header("Content-Disposition", "inline", filename="logo-sena.png")
        message.attach(logo)
    except OSError:
        # Sin logo igual se envía (el <img> quedará roto, el texto intacto).
        pass
    message.send(fail_silently=False)
