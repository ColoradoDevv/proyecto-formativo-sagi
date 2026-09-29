import { CloudAlert, ClipboardList } from "lucide-react";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";
import { DataTable } from "@/shared";
import useAuditLogs from "../hooks/useAuditLogs";

// ── Definición de columnas ────────────────────────────────────────────────────
// Las columnas con meta.filterVariant quedan expuestas en el panel de filtros
// del DataTable (icono ListFilter). Las columnas "date_*" son invisibles pero
// filtrables: permiten filtrar por rango de fecha sin ocupar espacio en la tabla.

const COLUMNS = [
    // Columna oculta para filtrar por fecha de inicio (filterVariant: "date")
    {
        id: "date_from",
        accessorFn: (row) => row.timestamp?.slice(0, 10) ?? "",   // "YYYY-MM-DD"
        header: "Desde",
        enableHiding: true,
        meta: { filterVariant: "date" },
        filterFn: (row, _columnId, filterValue) => {
            if (!filterValue) return true;
            const rowDate = row.original.timestamp?.slice(0, 10) ?? "";
            return rowDate >= filterValue;
        },
        cell: () => null,   // no se renderiza en tabla
    },
    // Columna oculta para filtrar por fecha de fin
    {
        id: "date_to",
        accessorFn: (row) => row.timestamp?.slice(0, 10) ?? "",
        header: "Hasta",
        enableHiding: true,
        meta: { filterVariant: "date" },
        filterFn: (row, _columnId, filterValue) => {
            if (!filterValue) return true;
            const rowDate = row.original.timestamp?.slice(0, 10) ?? "";
            return rowDate <= filterValue;
        },
        cell: () => null,
    },
    {
        accessorKey: "timestamp_formatted",
        header: "Fecha y hora",
        cell: ({ getValue }) => (
            <span className="whitespace-nowrap font-mono text-small">
                {getValue()}
            </span>
        ),
    },
    {
        accessorKey: "actor_name",
        header: "Usuario",
        meta: { filterVariant: "text" },
        cell: ({ getValue }) => (
            <span className="text-small">{getValue() || "Sistema"}</span>
        ),
    },
    {
        accessorKey: "module_display",
        header: "Módulo",
        meta: { filterVariant: "select" },
        cell: ({ getValue }) => (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-small">
                {getValue()}
            </span>
        ),
    },
    {
        accessorKey: "action_display",
        header: "Acción",
        meta: { filterVariant: "select" },
        cell: ({ getValue }) => {
            const label = getValue();
            const colorMap = {
                "Creación":             "text-success",
                "Eliminación":          "text-error",
                "Modificación":         "text-warning",
                "Activar / Desactivar": "text-info",
                "Inicio de sesión":     "text-primary",
                "Cierre de sesión":     "text-text-muted",
            };
            const cls = colorMap[label] ?? "text-text-primary";
            return <span className={`text-small font-medium ${cls}`}>{label}</span>;
        },
    },
    {
        accessorKey: "target_repr",
        header: "Objeto afectado",
        cell: ({ getValue }) => (
            <span className="text-small break-all">{getValue() || "—"}</span>
        ),
    },
    {
        accessorKey: "detail",
        header: "Detalle",
        cell: ({ getValue }) => (
            <span className="text-small text-text-secondary break-all">
                {getValue() || "—"}
            </span>
        ),
    },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function AuditLogPage() {
    // Sin filtros de API: cargamos todos los registros y filtramos en cliente.
    // Las columnas date_from/date_to aplican el filtro de rango localmente.
    const { logs, loading, error } = useAuditLogs({});

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-lg border border-text-secondary bg-text-secondary px-6 py-4 text-text-inverse max-w-md">
                    <CloudAlert className="shrink-0" />
                    <div>
                        <p className="font-heading">Error al cargar el historial</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full text-text-primary flex flex-col gap-4">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Historial de Auditoría</h2>
                    <p className="text-small text-text-secondary">
                        Registro de todas las acciones del sistema. Solo visible para el superadministrador.
                    </p>
                </div>
            </div>

            {/* Tabla — el icono ListFilter despliega Desde, Hasta, Usuario, Módulo y Acción */}
            <DataTable
                data={logs}
                columns={COLUMNS}
                hiddenColumns={["date_from", "date_to"]}
            />
        </div>
    );
}
