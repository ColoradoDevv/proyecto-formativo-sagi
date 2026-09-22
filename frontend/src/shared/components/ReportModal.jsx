import { useState } from "react";
import { FileText, TableProperties } from "lucide-react";
import { buildReportDataset } from "@/shared/reports/buildReportDataset";
import { generateExcelReport } from "@/shared/reports/generateExcelReport";
import { generatePdfReport } from "@/shared/reports/generatePdfReport";
import { getStoredUser } from "@/shared/services/api";
import Button from "./Button";
import Checkbox from "./Checkbox";
import Input from "./Input";
import Modal from "./Modal";

const FORMAT_OPTIONS = [
    { value: "pdf",   label: "PDF",   Icon: FileText },
    { value: "excel", label: "Excel", Icon: TableProperties },
];

const SCOPE_OPTIONS = [
    { value: "all",    label: "Todos" },
    { value: "filter", label: "Filtrar" },
];

export default function ReportModal({
    isOpen,
    onClose,
    data = [],
    fields = [],
    reportTitle = "Reporte",
    fileNamePrefix = "reporte",
}) {
    const [format, setFormat] = useState("pdf");
    const [selectedFields, setSelectedFields] = useState([]);
    const [scope, setScope] = useState("all");
    const [filterValue, setFilterValue] = useState("");

    // Reinicia el estado al pasar de cerrado a abierto, ajustando el estado
    // durante el render (patrón recomendado por React, sin efecto en cascada).
    const [wasOpen, setWasOpen] = useState(false);
    if (isOpen && !wasOpen) {
        setWasOpen(true);
        setFormat("pdf");
        setSelectedFields(fields.filter((f) => f.default));
        setScope("all");
        setFilterValue("");
    } else if (!isOpen && wasOpen) {
        setWasOpen(false);
    }

    const handleToggleField = (field) => {
        const exists = selectedFields.find((f) => f.key === field.key);
        setSelectedFields(
            exists
                ? selectedFields.filter((f) => f.key !== field.key)
                : [...selectedFields, field]
        );
    };

    const handleGenerate = async () => {
        if (selectedFields.length === 0) return;

        const { headers, rows } = buildReportDataset({
            data,
            selectedFields,
            scope,
            filterValue,
        });

        if (rows.length === 0) {
            alert("No hay registros que coincidan con el filtro aplicado.");
            return;
        }

        const date = new Date().toISOString().slice(0, 10);
        const generatedAt = new Date();
        const user = getStoredUser();
        const generatedBy = [user?.first_name, user?.last_name]
            .filter(Boolean)
            .join(" ") || user?.email || "Usuario no disponible";
        const ext = format === "excel" ? "xlsx" : "pdf";
        const fileName = `${fileNamePrefix}-${date}.${ext}`;

        if (format === "excel") {
            generateExcelReport({
                headers,
                rows,
                reportTitle,
                generatedBy,
                generatedAt,
                fileName,
            });
        } else {
            await generatePdfReport({
                headers,
                rows,
                reportTitle,
                generatedBy,
                generatedAt,
                fileName,
            });
        }

        onClose();
    };

    const footer = (
        <>
            <Button variant="secondary" onClick={onClose} className="sm:flex-1">
                Cancelar
            </Button>
            <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={selectedFields.length === 0}
                className="sm:flex-1"
            >
                Generar reporte
            </Button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Generar Reporte"
            variant="solid"
            size="lg"
            footer={footer}
        >
            <p className="text-small text-text-secondary -mt-3">{reportTitle}</p>

            {/* Format selector */}
            <div>
                <p className="text-small font-heading text-text-primary mb-3">
                    Formato de exportación
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {FORMAT_OPTIONS.map(({ value, label, Icon }) => (
                        <Button
                            key={value}
                            variant={format === value ? "primary" : "secondary"}
                            icon={Icon}
                            onClick={() => setFormat(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Field selection */}
            <div>
                <p className="text-small font-heading text-text-primary mb-3">
                    Campos a incluir{" "}
                    <span className="font-body text-text-secondary">
                        ({selectedFields.length} de {fields.length})
                    </span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4">
                    {fields.map((field) => (
                        <Checkbox
                            key={field.key}
                            id={`report-field-${field.key}`}
                            name={field.key}
                            label={field.label}
                            checked={selectedFields.some((f) => f.key === field.key)}
                            onChange={() => handleToggleField(field)}
                        />
                    ))}
                </div>
            </div>

            {/* Scope filter */}
            <div>
                <p className="text-small font-heading text-text-primary mb-3">Registros</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    {SCOPE_OPTIONS.map(({ value, label }) => (
                        <Button
                            key={value}
                            variant={scope === value ? "primary" : "secondary"}
                            onClick={() => setScope(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                {scope === "filter" && (
                    <Input
                        name="reportFilter"
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        placeholder="Texto a buscar en los registros…"
                    />
                )}
            </div>
        </Modal>
    );
}
