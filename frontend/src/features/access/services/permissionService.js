import { apiFetch, throwApiError } from "@/shared/services/api";

// METODO GET (obtener los permisos asignados a un grupo)
export async function getGroupPermissions(groupId) {
    const response = await apiFetch(`/api/permissions/groups/${groupId}/`);
    if (!response.ok) await throwApiError(response);
    const group = await response.json();
    return group.permissions ?? [];
}
