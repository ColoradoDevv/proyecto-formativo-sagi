// Alcance de permisos con objeto (Fase 6). Espejo de
// backend/modules/permissions/ranking.py::SCOPED_PERMISSIONS —
// mantener sincronizado: préstamos (responsable/receptor) y
// asignaciones de tareas (asignado directo o por grupo).

export const SCOPED_PERMISSIONS = new Set([
    "view_loan",
    "list_loans",
    "edit_loan",
    "delete_loan",
    "return_material",
    "register_surplus",
    "validate_loan_return",
    "view_task_assignment",
    "edit_task_assignment",
    "delete_task_assignment",
]);

export const SCOPE_SELF = "SELF";
export const SCOPE_ALL = "ALL";

export const SCOPE_OPTIONS = [
    { id: SCOPE_SELF, label: "Propio" },
    { id: SCOPE_ALL, label: "Global" },
];

export function scopeLabel(scope) {
    return scope === SCOPE_ALL ? "Global" : "Propio";
}
