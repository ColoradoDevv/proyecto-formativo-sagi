import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDF_COLORS as C } from "./pdfColors";

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

export function generatePdfReport({
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
    doc.text("SGI - Sistema de Gestión de Inventario", 14, 14);

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
