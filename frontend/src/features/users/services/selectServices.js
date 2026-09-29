import { apiFetch, throwApiError } from "@/shared/services/api";

export async function getDocumentTypes() {
    const response = await apiFetch("/api/users/document-types/");
    if (!response.ok) await throwApiError(response);
    const data = await response.json();
    return data.map((item) => ({ id: item.id, label: item.name }));
}

export async function getUserRoles() {
    const response = await apiFetch("/api/users/roles/");
    if (!response.ok) await throwApiError(response);
    const data = await response.json();
    return data.map((item) => ({ id: item.id, label: item.name }));
}

export async function getUserGroups(signal) {
    const response = await apiFetch("/api/permissions/groups/", { signal });
    if (!response.ok) await throwApiError(response);
    const data = await response.json();
    return data.map((item) => ({ id: item.id, label: item.name }));
}

// METODO POST (crear un nuevo grupo de usuario)
export async function createUserGroup(name) {
    const response = await apiFetch("/api/permissions/groups/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) await throwApiError(response, { name: "groups" });
    const data = await response.json();
    return { id: data.id, label: data.name };
}
