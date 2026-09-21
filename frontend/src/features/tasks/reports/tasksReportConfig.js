// Reporte de ASIGNACIONES de tarea (TaskAssignment).
// Cada fila = una asignacion a un usuario o grupo con su estado, fechas y
// trazabilidad basica. Es el reporte principal cuando se ve la vista de
// "Asignaciones" en /tareas.
export const tasksAssignmentsReportConfig = {
    reportTitle:    "Reporte de Asignaciones de Tareas",
    fileNamePrefix: "reporte-asignaciones-tareas",
    fields: [
        { key: "id",          label: "ID",                default: true  },
        { key: "task_name",   label: "Tarea",             default: true  },
        {
            key: "scope",
            label: "Tipo",
            default: true,
            accessor: (row) => {
                if (row.scope === "group") return "Grupo";
                if (row.scope === "user")  return "Usuario";
                return row.scope ?? "-";
            },
        },
        {
            // Destinatario: nombre del usuario o del grupo segun scope.
            // Recae sobre `recipient_name` (campo que el backend expone ya
            // resuelto) y, como fallback, une user_name / group_name.
            key: "recipient",
            label: "Destinatario",
            default: true,
            accessor: (row) => {
                if (row.recipient_name) return row.recipient_name;
                if (row.scope === "group") return row.group_name ?? "-";
                if (row.scope === "user" || row.user_name) return row.user_name ?? "-";
                return "-";
            },
        },
        { key: "start_date",  label: "Fecha inicio",      default: true  },
        { key: "end_date",    label: "Fecha fin",         default: true  },
        { key: "state",       label: "Estado",            default: true  },
        {
            key: "assigned_at",
            label: "Asignado el",
            default: false,
            accessor: (row) => formatDateTime(row.assigned_at),
        },
        {
            key: "completed_at",
            label: "Completado el",
            default: false,
            accessor: (row) => formatDateTime(row.completed_at),
        },
    ],
};

// Reporte de DEFINICIONES de tarea (TaskDefinition).
// Cada fila = una tarea reusable del catalogo. Es el reporte principal
// cuando se ve la vista de "Tareas (definiciones)" en /tareas.
export const tasksDefinitionsReportConfig = {
    reportTitle:    "Reporte de Tareas (Definiciones)",
    fileNamePrefix: "reporte-tareas",
    fields: [
        { key: "id",          label: "ID",          default: true  },
        { key: "name",        label: "Título",      default: true  },
        { key: "description", label: "Descripción", default: true  },
        {
            key: "created_at",
            label: "Creada el",
            default: false,
            accessor: (row) => formatDateTime(row.created_at),
        },
    ],
};

// Helper: formatea fechas ISO a un string legible. El dataset builder llama
// a String() sobre el valor del accessor, asi que un Date no se serializa
// correctamente sin esta conversion.
function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
