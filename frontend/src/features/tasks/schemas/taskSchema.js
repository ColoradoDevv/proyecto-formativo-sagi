import { z } from "zod";

// Comprueba que el string sea una fecha real (rechaza "2024-13-40", "0000-00-00").
function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(`${value}T00:00:00`);
    return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === y &&
        date.getMonth() + 1 === m &&
        date.getDate() === d
    );
}

// Estados disponibles para una asignacion de tarea. Reutilizable en selects.
export const TASK_STATES = [
    { id: "Pendiente", label: "Pendiente" },
    { id: "En progreso", label: "En progreso" },
    { id: "En revisión", label: "En revisión" },
    { id: "Completada", label: "Completada" },
    { id: "Cancelada", label: "Cancelada" },
];

// Estados desde los que el asignado puede marcar su tarea como terminada.
export const FINISHABLE_STATES = ["Pendiente", "En progreso"];

// Alcance del destinatario de la asignacion.
export const ASSIGNMENT_SCOPES = [
    { id: "user",  label: "Usuario individual" },
    { id: "group", label: "Grupo de usuarios" },
];

// Esquema de la PLANTILLA de tarea (TaskDefinition).
export const taskDefinitionSchema = z.object({
    taskName: z
        .string()
        .trim()
        .min(3, "El titulo debe tener minimo 3 caracteres")
        .max(100, "El titulo es demasiado largo"),

    taskDescription: z
        .string()
        .trim()
        .min(3, "La descripcion debe tener minimo 3 caracteres")
        .max(255, "La descripcion no puede superar 255 caracteres"),
});

// Esquema base de una asignacion. Aplica tanto para usuarios como para grupos:
// segun `assignmentScope`, exactamente uno de `taskUser` / `taskGroup` debe
// estar presente. Las fechas son independientes por asignacion.
export const taskAssignmentSchema = z.object({
    task: z
        .string()
        .min(1, "Debe seleccionar una tarea"),

    assignmentScope: z.enum(["user", "group"], {
        errorMap: () => ({ message: "Debe seleccionar el alcance de la asignacion" }),
    }),

    taskUser: z
        .string()
        .optional()
        .or(z.literal("")),

    taskGroup: z
        .string()
        .optional()
        .or(z.literal("")),

    taskState: z
        .string()
        .min(1, "Debe seleccionar un estado"),

    taskStartDate: z
        .string()
        .min(1, "Debe ingresar una fecha de inicio")
        .refine(isValidDateString, { message: "Debe ingresar una fecha valida" }),

    taskEndDate: z
        .string()
        .min(1, "Debe ingresar una fecha de finalizacion")
        .refine(isValidDateString, { message: "Debe ingresar una fecha valida" }),

    requiresEvidence: z.boolean().optional().default(false),
})
.refine(
    (data) => !data.taskStartDate || !data.taskEndDate || data.taskEndDate >= data.taskStartDate,
    { message: "La fecha de fin no puede ser anterior a la de inicio", path: ["taskEndDate"] }
)
.refine(
    (data) => {
        if (data.assignmentScope === "user") return !!data.taskUser && data.taskUser !== "";
        if (data.assignmentScope === "group") return !!data.taskGroup && data.taskGroup !== "";
        return true;
    },
    (data) => {
        if (data.assignmentScope === "user") {
            return { message: "Debe seleccionar un usuario", path: ["taskUser"] };
        }
        return { message: "Debe seleccionar un grupo", path: ["taskGroup"] };
    }
);
