import TaskStateBadge from "../components/TaskStateBadge";
import DefinitionRowActions from "../components/DefinitionRowActions";
import AssignmentRowActions from "../components/AssignmentRowActions";

// Pildora compacta que distingue entre asignacion a usuario o grupo.
const SCOPE_LABEL = {
    user:  { text: "Usuario", cls: "bg-surface-muted text-text-secondary" },
    group: { text: "Grupo",   cls: "bg-brand-soft text-brand" },
};

// Columnas para la lista de ASIGNACIONES (vista por defecto en TaskListPage).
// Una fila = una asignacion concreta (usuario o grupo con su estado y fechas).
// `canEdit` / `canDelete` controlan que acciones se muestran al usuario
// (regla: solo admin/supervisor con edit_task_assignment pueden cambiar estados).
export const assignmentColumns = ({ onView, onEdit, onDeleted, canEdit = true, canDelete = true }) => [
    {
        accessorKey: "task_name",
        header: "Tarea",
    },
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
    {
        accessorKey: "start_date",
        header: "Fecha inicio",
    },
    {
        accessorKey: "end_date",
        header: "Fecha fin",
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
                onView={onView}
                onEdit={onEdit}
                onDeleted={onDeleted}
            />
        ),
    },
];

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
        accessorKey: "created_at",
        header: "Creada",
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
