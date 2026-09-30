import { apiFetch, throwApiError } from "@/shared/services/api";

// METODO GET (obtener los permisos asignados a un grupo)
// Devuelve asignaciones {codename, scope} (Fase 6: alcance por asignación).
export async function getGroupPermissions(groupId) {
    const response = await apiFetch(`/api/permissions/groups/${groupId}/`);
    if (!response.ok) await throwApiError(response);
    const group = await response.json();
    return (group.group_permissions ?? []).map((assignment) => ({
        codename: assignment.permission_codename,
        scope: assignment.scope ?? "SELF",
    }));
}
