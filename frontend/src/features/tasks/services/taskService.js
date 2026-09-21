import { apiFetch, throwApiError } from "@/shared/services/api";

// Mapea los campos del backend a las keys del formulario de asignacion,
// para mostrar el error de validacion junto al input correcto.
const ASSIGNMENT_FIELD_MAP = {
    task: "task",
    scope: "assignmentScope",
    user: "taskUser",
    group: "taskGroup",
    state: "taskState",
    start_date: "taskStartDate",
    end_date: "taskEndDate",
};

const DEFINITION_FIELD_MAP = {
    name: "taskName",
    description: "taskDescription",
};

function buildQuery(params) {
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
    if (entries.length === 0) return "";
    const qs = new URLSearchParams(entries).toString();
    return `?${qs}`;
}

// ---------------------------------------------------------------------------
// Definiciones de tarea (TaskDefinition)
// ---------------------------------------------------------------------------

export async function getDefinitions() {
    const response = await apiFetch("/api/tasks/definitions/");
    if (!response.ok) await throwApiError(response, DEFINITION_FIELD_MAP);
    return response.json();
}

export async function getDefinitionById(id) {
    const response = await apiFetch(`/api/tasks/definitions/${id}/`);
    if (!response.ok) await throwApiError(response, DEFINITION_FIELD_MAP);
    return response.json();
}

export async function createDefinition({ taskName, taskDescription }) {
    const response = await apiFetch("/api/tasks/definitions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: taskName,
            description: taskDescription,
        }),
    });
    if (!response.ok) await throwApiError(response, DEFINITION_FIELD_MAP);
    return response.json();
}

export async function updateDefinition(id, { taskName, taskDescription }) {
    const response = await apiFetch(`/api/tasks/definitions/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: taskName,
            description: taskDescription,
        }),
    });
    if (!response.ok) await throwApiError(response, DEFINITION_FIELD_MAP);
    return response.json();
}

export async function deleteDefinition(id) {
    const response = await apiFetch(`/api/tasks/definitions/${id}/`, { method: "DELETE" });
    if (!response.ok) await throwApiError(response, DEFINITION_FIELD_MAP);
}

// ---------------------------------------------------------------------------
// Asignaciones de tarea (TaskAssignment) — soporta scope=user | scope=group
// ---------------------------------------------------------------------------

export async function getAssignments({ user, group, task, state, scope } = {}) {
    const response = await apiFetch(`/api/tasks/assignments/${buildQuery({ user, group, task, state, scope })}`);
    if (!response.ok) await throwApiError(response, ASSIGNMENT_FIELD_MAP);
    return response.json();
}

export async function getAssignmentById(id) {
    const response = await apiFetch(`/api/tasks/assignments/${id}/`);
    if (!response.ok) await throwApiError(response, ASSIGNMENT_FIELD_MAP);
    return response.json();
}

export async function getAssignmentsByUser(userId) {
    return getAssignments({ user: userId });
}

export async function getAssignmentsByGroup(groupId) {
    return getAssignments({ group: groupId });
}

export async function getAssignmentsByTask(taskId) {
    return getAssignments({ task: taskId });
}

// payload esperado (claves del formulario):
//   { task, assignmentScope, taskUser?, taskGroup?, taskState, taskStartDate, taskEndDate }
export async function createAssignment(payload) {
    const body = {
        task: typeof payload.task === "object" ? payload.task.id : payload.task,
        scope: payload.assignmentScope,
        state: payload.taskState,
        start_date: payload.taskStartDate,
        end_date: payload.taskEndDate,
    };
    if (payload.assignmentScope === "user") {
        body.user = payload.taskUser;
    } else if (payload.assignmentScope === "group") {
        body.group = payload.taskGroup;
    }

    const response = await apiFetch("/api/tasks/assignments/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) await throwApiError(response, ASSIGNMENT_FIELD_MAP);
    return response.json();
}

export async function updateAssignment(id, payload) {
    const body = {};
    if ("assignmentScope" in payload) body.scope     = payload.assignmentScope;
    if ("taskUser"        in payload) body.user      = payload.taskUser;
    if ("taskGroup"       in payload) body.group     = payload.taskGroup;
    if ("taskState"       in payload) body.state     = payload.taskState;
    if ("taskStartDate"   in payload) body.start_date = payload.taskStartDate;
    if ("taskEndDate"     in payload) body.end_date  = payload.taskEndDate;
    if ("task"            in payload) body.task      = typeof payload.task === "object" ? payload.task.id : payload.task;

    const response = await apiFetch(`/api/tasks/assignments/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) await throwApiError(response, ASSIGNMENT_FIELD_MAP);
    return response.json();
}

export async function deleteAssignment(id) {
    const response = await apiFetch(`/api/tasks/assignments/${id}/`, { method: "DELETE" });
    if (!response.ok) await throwApiError(response, ASSIGNMENT_FIELD_MAP);
}
