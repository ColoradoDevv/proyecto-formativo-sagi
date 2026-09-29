import { apiFetch } from "@/shared/services/api";

// Lista de usuarios para el selector de "usuario asignado".
export async function getUsers() {
    const response = await apiFetch("/api/users/");
    const data = await response.json();
    return data.map((user) => ({ id: String(user.id), label: `${user.first_name} ${user.last_name}` }));
}

// Lista de grupos para el selector de "grupo asignado".
// Excluye SADMIN (ya viene excluido del backend), pero filtramos por si acaso.
export async function getGroups() {
    const response = await apiFetch("/api/permissions/groups/");
    const data = await response.json();
    return data
        .filter((g) => String(g.name).toUpperCase() !== "SADMIN")
        .map((g) => ({ id: String(g.id), label: g.name }));
}
