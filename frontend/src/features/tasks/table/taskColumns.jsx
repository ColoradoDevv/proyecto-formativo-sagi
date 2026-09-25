/* eslint-disable react-refresh/only-export-components -- módulo de columnas: las celdas viven junto a su definición */
import TaskStateBadge from "../components/TaskStateBadge";
import DefinitionRowActions from "../components/DefinitionRowActions";
import AssignmentRowActions from "../components/AssignmentRowActions";

// Fecha ISO del backend → formato legible es-CO (antes se veía cruda).
function formatDate(value) {
    if (!value) return "—";
    try {
        return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
    } catch {
        return String(value);
    }
}

// Pildora compacta que distingue entre asignacion a usuario o grupo.
const SCOPE_LABEL = {
    user:  { text: "Usuario", cls: "bg-surface-muted text-text-secondary" },
    group: { text: "Grupo",   cls: "bg-brand-soft text-brand" },
};

// Columnas para la lista de ASIGNACIONES (vista por defecto en TaskListPage).
// Una fila = una asignacion concreta (usuario o grupo con su estado y fechas).
// `canEdit` / `canDelete` controlan que acciones se muestran al usuario
// (regla: solo admin/supervisor con edit_task_assignment pueden cambiar estados).
// `canFinish` / `onFinish`: botón "terminada" para el propio asignado.
// `simple`: vista normal del asignado (oculta Tipo/Destinatario, que solo
// importan en la vista administrativa).
export const assignmentColumns = ({ onView, onEdit, onDeleted, canEdit = true, canDelete = true, canFinish = false, onFinish, simple = false }) => [
    {
        accessorKey: "task_name",
        header: "Tarea",
    },
    {
        id: "description",
        header: "Descripción",
        accessorFn: (row) => row.task_description ?? "—",
        cell: ({ row }) => (
            <span className="block max-w-md truncate" title={row.original.task_description ?? ""}>
                {row.original.task_description ?? "—"}
            </span>
        ),
    },
    ...(!simple ? [
    {
        id: "scope",
        header: "Tipo",
        cell: ({ row }) => {
            const scope = row.original.scope;
            const meta = SCOPE_LABEL[scope] ?? SCOPE_LABEL.user;
            return (
                <span className={`inline-block text-small font-medium px-2 py-0.5 rounded-[var(--radius-full)] ${meta.cls}`}>
                    {meta.text}
                </span>
            );
        },
    },
    {
        id: "recipient",
        header: "Destinatario",
        cell: ({ row }) => {
            const a = row.original;
            if (a.scope === "group") return a.group_name || a.recipient_name || "—";
            return a.user_name || a.recipient_name || "—";
        },
    },
    ] : []),
    {
        accessorKey: "start_date",
        header: "Fecha inicio",
    },
    {
        accessorKey: "end_date",
        header: "Fecha fin",
    },
    {
        id: "deadline",
        header: "Plazo",
        cell: ({ row }) => <DeadlineCell endDate={row.original.end_date} />,
    },
    {
        accessorKey: "state",
        header: "Estado",
        cell: ({ row }) => <TaskStateBadge state={row.original.state} />,
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
            <AssignmentRowActions
                assignment={row.original}
                canEdit={canEdit}
                canDelete={canDelete}
                canFinish={canFinish}
                onView={onView}
                onEdit={onEdit}
                onFinish={onFinish}
                onDeleted={onDeleted}
            />
        ),
    },
];

// Plazo restante calculado desde la fecha de fin.
function DeadlineCell({ endDate }) {
    if (!endDate) return "—";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(end.getTime())) return "—";
    const diff = Math.round((end - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-error-soft text-error text-small font-medium whitespace-nowrap">
                Vencida hace {Math.abs(diff)} día(s)
            </span>
        );
    }
    if (diff === 0) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning-soft text-warning text-small font-medium whitespace-nowrap">
                Vence hoy
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-muted text-text-secondary text-small font-medium whitespace-nowrap">
            Quedan {diff} día(s)
        </span>
    );
}

// Columnas para la lista de DEFINICIONES de tarea.
// Una fila = una tarea reusable (catalogo).
export const definitionColumns = ({ onView, onEdit, onDeleted, onManage, canEdit = true, canDelete = true }) => [
    {
        accessorKey: "name",
        header: "Titulo",
    },
    {
        accessorKey: "description",
        header: "Descripcion",
        cell: ({ row }) => (
            <span className="block max-w-md truncate" title={row.original.description}>
                {row.original.description}
            </span>
        ),
    },
    {
        id: "assignments_count",
        header: "Asignaciones",
        cell: ({ row }) => {
            const count = row.original.assignments_count ?? 0;
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-surface-muted text-small font-medium text-text-secondary">
                    {count} {count === 1 ? "persona" : "personas"}
                </span>
            );
        },
    },
    {
        accessorKey: "created_at",
        header: "Creada",
        cell: ({ row }) => (
            <span className="whitespace-nowrap">{formatDate(row.original.created_at)}</span>
        ),
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
            <DefinitionRowActions
                definition={row.original}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={onView}
                onEdit={onEdit}
                onDeleted={onDeleted}
                onManage={onManage}
            />
        ),
    },
];
