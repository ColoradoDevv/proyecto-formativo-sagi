import jsPDF from "jspdf";
import { getStoredUser, getToken } from "@/shared/services/api";
import { PDF_COLORS as C } from "./pdfColors";
import { getSenaLogoBlanco } from "./senaLogo";

// ── Contraseña de propietario aleatoria (RC4-128) ──────────────────────────
function _ownerPassword() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Carga una imagen desde URL como dataURL (para foto de perfil) ──────────
// /media/* exige sesión: se manda el JWT en el header (fetch sí puede).
async function _loadImageAsDataUrl(url) {
    try {
        const headers = {};
        const token = getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// ── Helper: dibuja una sección con título ──────────────────────────────────
function _drawSectionTitle(doc, text, y) {
    doc.setFillColor(...C.steel);
    doc.rect(14, y, 182, 7, "F");
    doc.setFontSize(9);
    doc.setTextColor(...C.white);
    doc.setFont(undefined, "bold");
    doc.text(text.toUpperCase(), 17, y + 5);
    doc.setFont(undefined, "normal");
    return y + 7;
}

// ── Helper: dibuja una cuadrícula de campo:valor ───────────────────────────
// fields: [{ label, value }]   cols: 1 | 2
function _drawFields(doc, fields, startY, cols = 2) {
    const pageW   = 210;
    const marginL = 14;
    const usable  = pageW - marginL * 2;   // 182 mm
    const colW    = usable / cols;
    const rowH    = 8;
    const padX    = 3;

    let col = 0;
    let y   = startY;

    fields.forEach(({ label, value }, i) => {
        const x    = marginL + col * colW;
        const isAlt = Math.floor(i / cols) % 2 === 1;

        // Fondo alterno
        doc.setFillColor(...(isAlt ? C.stripe : C.white));
        doc.rect(x, y, colW, rowH, "F");

        // Etiqueta
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.setFont(undefined, "bold");
        doc.text(label, x + padX, y + 3.5);

        // Valor
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.setFont(undefined, "normal");
        // Truncar si es muy largo
        const maxW = colW - padX * 2;
        const safeVal = doc.splitTextToSize(String(value ?? "-"), maxW)[0] ?? "-";
        doc.text(safeVal, x + padX, y + 7);

        col++;
        if (col >= cols) {
            col = 0;
            y += rowH;
        }
    });

    // Si la última fila quedó incompleta, avanzar Y
    if (col > 0) y += rowH;

    return y + 2; // pequeño margen inferior
}

// ── Función principal ──────────────────────────────────────────────────────
export async function generateUserProfileReport(user) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit:        "mm",
        format:      "a4",
        encryption: {
            userPassword:    "",
            ownerPassword:   _ownerPassword(),
            userPermissions: ["print", "print-high-quality"],
        },
    });

    const generatedAt = new Date();
    const dateTime = new Intl.DateTimeFormat("es-CO", {
        dateStyle: "long",
        timeStyle: "medium",
    }).format(generatedAt);

    const currentUser  = getStoredUser();
    const generatedBy  = [currentUser?.first_name, currentUser?.last_name]
        .filter(Boolean).join(" ") || currentUser?.email || "Usuario no disponible";

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

    // ── Encabezado ─────────────────────────────────────────────────────────
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, 210, 28, "F");

    // Logosímbolo oficial en blanco sobre la banda (si falla, sigue el texto).
    const senaLogo = await getSenaLogoBlanco();
    const headerX = 14;
    if (senaLogo) {
        try {
            doc.addImage(senaLogo, "PNG", headerX, 5, 18, 18);
        } catch { /* continuar sin logo */ }
    }
    const textX = senaLogo ? headerX + 21 : headerX;

    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.setFont(undefined, "bold");
    doc.text("SENA · SAGI — Sistema Administrativo de Gestión de Inventarios", textX, 10);

    doc.setFontSize(15);
    doc.text("Ficha Individual de Usuario", textX, 19);

    // Fecha en esquina superior derecha
    doc.setFontSize(7.5);
    doc.setFont(undefined, "normal");
    doc.text(dateTime, 196, 10, { align: "right" });
    doc.text(`Generado por: ${generatedBy}`, 196, 15, { align: "right" });

    // ── Foto de perfil ─────────────────────────────────────────────────────
    let photoY     = 33;
    const photoSize = 28;
    const photoX   = 14;
    let contentX   = 14;

    if (user.profile_picture) {
        const imgData = await _loadImageAsDataUrl(user.profile_picture);
        if (imgData) {
            doc.setDrawColor(...C.lightGray);
            doc.setLineWidth(0.4);
            doc.rect(photoX, photoY, photoSize, photoSize);
            doc.addImage(imgData, "JPEG", photoX, photoY, photoSize, photoSize);
            contentX = photoX + photoSize + 5;
        }
    }

    // Nombre y estado junto a la foto (o en el margen si no hay foto)
    doc.setFontSize(14);
    doc.setTextColor(...C.navy);
    doc.setFont(undefined, "bold");
    doc.text(fullName, contentX, photoY + 8);

    const groupsLabel = user.groups?.length
        ? user.groups.map((g) => g.name ?? g).join(", ")
        : "Sin grupo";
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...C.muted);
    doc.text(groupsLabel, contentX, photoY + 14);

    const isActive = user.is_active === true;
    // Pastilla de estado (rectángulo + texto, sin caracteres especiales)
    const badgeLabel = isActive ? "Activo" : "Inactivo";
    const badgeBg    = isActive ? [220, 252, 231] : [254, 226, 226]; // verde-suave / rojo-suave
    const badgeText  = isActive ? [22, 101, 52]   : [153, 27, 27];
    const badgeW     = 22;
    const badgeH     = 5.5;
    doc.setFillColor(...badgeBg);
    doc.roundedRect(contentX, photoY + 17, badgeW, badgeH, 1.5, 1.5, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...badgeText);
    doc.setFont(undefined, "bold");
    doc.text(badgeLabel, contentX + badgeW / 2, photoY + 21.2, { align: "center" });

    let curY = Math.max(photoY + photoSize + 5, 68);

    // ── Sección 1: Información Personal ───────────────────────────────────
    curY = _drawSectionTitle(doc, "Información Personal", curY);
    const docTypeName = user.document_type?.name ?? "-";
    curY = _drawFields(doc, [
        { label: "Nombres",           value: user.first_name       ?? "-" },
        { label: "Apellidos",         value: user.last_name        ?? "-" },
        { label: "Tipo de documento", value: docTypeName                   },
        { label: "N° de documento",   value: user.document_number  ?? "-" },
        { label: "Dirección",         value: user.address          ?? "-" },
        { label: "N° documento",      value: user.document_number  ?? "-" },
    ], curY, 2);

    // ── Sección 2: Contacto ────────────────────────────────────────────────
    curY = _drawSectionTitle(doc, "Información de Contacto", curY);
    curY = _drawFields(doc, [
        { label: "Correo personal",      value: user.email               ?? "-" },
        { label: "Correo institucional", value: user.institutional_email ?? "-" },
        { label: "Teléfono",             value: user.phone_number        ?? "-" },
        { label: "Teléfono adicional",   value: user.second_phone_number ?? "-" },
    ], curY, 2);

    // ── Sección 3: Sistema ─────────────────────────────────────────────────
    curY = _drawSectionTitle(doc, "Información del Sistema", curY);
    const isInst = user.groups?.some((g) => {
        const n = (g.name ?? "").toUpperCase();
        return n.includes("INST") || n.includes("INSTRUCTOR");
    });
    const systemFields = [
        { label: "Tipo de usuario",    value: groupsLabel },
        { label: "Estado",             value: isActive ? "Activo" : "Inactivo" },
        { label: "Fecha de inicio",    value: user.start_date ?? "-" },
        { label: "Fecha de fin",       value: user.end_date   ?? "-" },
    ];
    if (isInst) {
        systemFields.push({
            label: "Instructor de Planta",
            value: user.is_instructor_planta ? "Sí" : "No",
        });
    }
    _drawFields(doc, systemFields, curY, 2);

    // ── Pie de página ──────────────────────────────────────────────────────
    const pageH = 297;
    doc.setDrawColor(...C.lightGray);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 12, 196, pageH - 12);

    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.setFont(undefined, "normal");
    doc.text(
        "Documento generado automáticamente por SAGI. No válido sin firma electrónica del administrador.",
        14,
        pageH - 8,
    );
    doc.text(`Página 1 de 1`, 196, pageH - 8, { align: "right" });

    // ── Guardar ────────────────────────────────────────────────────────────
    const date       = new Date().toISOString().slice(0, 10);
    const identifier = user.document_number ?? user.id ?? "desconocido";
    const fileName   = `reporte-usuario-${identifier}-${date}.pdf`;
    doc.save(fileName);
}
