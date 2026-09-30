import { apiFetch, throwApiError } from "@/shared/services/api";

const BASE = "/api/permissions/roles/requests/";

async function request(path = "", options = {}) {
    const response = await apiFetch(`${BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!response.ok) await throwApiError(response);
    if (response.status === 204) return null;
    return response.json();
}

export function listSolicitudes(signal) {
    return apiFetch(BASE, { signal }).then(async (response) => {
        if (!response.ok) await throwApiError(response);
        return response.json();
    });
}

export function submitSolicitud(id) {
    return request(`${id}/submit/`, { method: "POST", body: "{}" });
}

export function approveSolicitud(id, { password, totp_code, perm_codenames, decision_reason }) {
    return request(`${id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ password, totp_code, perm_codenames, decision_reason }),
    });
}

export function rejectSolicitud(id, { password, totp_code, decision_reason }) {
    return request(`${id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ password, totp_code, decision_reason }),
    });
}

export function cancelSolicitud(id) {
    return request(`${id}/cancel/`, { method: "POST", body: "{}" });
}
