import { apiFetch, throwApiError } from "@/shared/services/api";

// METODO GET (obtener lista de usuarios para el selector de "Usuario individual")
export async function getUsers() {
    const response = await apiFetch("/api/users/");
    if (!response.ok) await throwApiError(response);
    return response.json();
}

// METODO GET (obtener los permisos efectivos de un usuario, propios + heredados de sus grupos)
export async function getUserPermissions(userId) {
    const response = await apiFetch(`/api/permissions/users/${userId}/permissions/`);
    if (!response.ok) await throwApiError(response);
    return response.json();
}

// METODO POST (asignar un permiso directo a un usuario; scope opcional)
export async function assignUserPermission(userId, permissionCodename, scope) {
    const body = { permission_codename: permissionCodename };
    if (scope) body.scope = scope;
    const response = await apiFetch(`/api/permissions/users/${userId}/permissions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

// METODO DELETE (remover un permiso directo de un usuario)
export async function removeUserPermission(userId, permissionCodename) {
    const response = await apiFetch(`/api/permissions/users/${userId}/permissions/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission_codename: permissionCodename }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}
