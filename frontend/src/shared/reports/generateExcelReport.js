import * as XLSX from "xlsx";

export function generateExcelReport({
    headers,
    rows,
    reportTitle,
    generatedBy = "Usuario no disponible",
    generatedAt = new Date(),
    fileName = "reporte.xlsx",
}) {
    const dateTime = new Intl.DateTimeFormat("es-CO", {
        dateStyle: "long",
        timeStyle: "medium",
    }).format(generatedAt);

    const sheetData = [
        ["SENA · SAGI — Sistema Administrativo de Gestión de Inventarios"],
        [reportTitle],
        [`Generado por: ${generatedBy}`],
        [`Fecha y hora: ${dateTime}`],
        [],
        headers,
        ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const colCount = headers.length;
    const lastColumn = Math.max(colCount - 1, 0);
    ws["!merges"] = [0, 1, 2, 3].map((row) => ({
        s: { r: row, c: 0 },
        e: { r: row, c: lastColumn },
    }));
    ws["!cols"] = Array(colCount).fill({ wch: 30 });
    ws["!rows"] = [{ hpx: 20 }, { hpx: 28 }, { hpx: 18 }, { hpx: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, fileName);
}
