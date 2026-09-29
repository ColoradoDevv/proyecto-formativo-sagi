import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDF_COLORS as C } from "./pdfColors";
import { getSenaLogoVerde } from "./senaLogo";

/**
 * Genera un PDF protegido contra modificaciones.
 *
 * Seguridad aplicada (RFADMIN26):
 *   - userPassword:  ninguna   → el documento se puede ABRIR sin contraseña.
 *   - ownerPassword: UUID v4   → se requiere para modificar o desproteger.
 *   - userPermissions: ["print", "print-high-quality"]
 *     → Se permite imprimir (alta y baja calidad) pero se bloquean:
 *       copy, modify, annot-forms, fill-forms, extract, assemble.
 *   - keySize 128 bit (RC4-128) — soportado universalmente por los lectores
 *     de PDF; keySize 256 usaría AES-256 pero requiere Acrobat X o superior.
 */
function _ownerPassword() {
    // Contraseña de propietario aleatoria de 32 caracteres.
    // El usuario final nunca la ve; solo sirve para que el motor de PDF
    // establezca las restricciones de permisos.
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generatePdfReport({
    headers,
    rows,
    reportTitle,
    generatedBy = "Usuario no disponible",
    generatedAt = new Date(),
    fileName = "reporte.pdf",
}) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        encryption: {
            userPassword:     "",               // sin contraseña para abrir
            ownerPassword:    _ownerPassword(), // propietario aleatorio → nadie puede editar
            userPermissions:  ["print", "print-high-quality"],
        },
    });

    const dateTime = new Intl.DateTimeFormat("es-CO", {
        dateStyle: "long",
        timeStyle: "medium",
    }).format(generatedAt);

    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text("SENA · SAGI — Sistema Administrativo de Gestión de Inventarios", 32, 12);

    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Servicio Nacional de Aprendizaje", 32, 17);

    // Logosímbolo oficial (si no carga, el encabezado de texto sigue válido).
    const logo = await getSenaLogoVerde();
    if (logo) {
        try {
            doc.addImage(logo, "PNG", 12, 5, 15, 15);
        } catch { /* logo corrupto: continuar sin él */ }
    }

    doc.setFontSize(16);
    doc.setTextColor(...C.navy);
    doc.text(reportTitle, 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(`Generado por: ${generatedBy}`, 14, 29);
    doc.text(`Fecha y hora: ${dateTime}`, 14, 35);

    autoTable(doc, {
        startY: 42,
        head: [headers],
        body: rows,
        theme: "grid",
        headStyles: {
            fillColor: C.steel,
            textColor: C.white,
            fontSize: 10,
            fontStyle: "bold",
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        alternateRowStyles: {
            fillColor: C.stripe,
        },
        margin: { left: 14, right: 14 },
    });

    doc.save(fileName);
}
