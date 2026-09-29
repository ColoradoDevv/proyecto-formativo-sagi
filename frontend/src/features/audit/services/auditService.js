import { apiFetch, throwApiError } from "@/shared/services/api";

/**
 * Obtiene el listado paginado/filtrado del historial de auditoría.
 *
 * Parámetros opcionales (se pasan como query-string):
 *   - search   : texto libre (actor_name, target_repr, detail)
 *   - module   : módulo del sistema (users, loans, etc.)
 *   - action   : tipo de acción (CREATE, UPDATE, etc.)
 *   - actor    : id del usuario actor
 *   - date_from: fecha inicio YYYY-MM-DD
 *   - date_to  : fecha fin   YYYY-MM-DD
 */
export async function getAuditLogs(params = {}, signal) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            query.append(key, value);
        }
    });

    const url = `/api/audit/${query.toString() ? `?${query}` : ""}`;
    const response = await apiFetch(url, { signal });
    if (!response.ok) await throwApiError(response);
    return response.json();
}
