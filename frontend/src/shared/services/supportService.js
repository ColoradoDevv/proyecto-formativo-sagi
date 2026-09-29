// Servicio del correo de soporte.
// GET es público (se muestra en el login sin sesión); PUT exige superusuario.
import { apiFetch, throwApiError } from "./api";

const SUPPORT_URL = "/api/support/email/";

export async function getSupportEmail(signal) {
    // Sin token a propósito: debe funcionar en el login sin sesión.
    const response = await fetch(SUPPORT_URL, { signal });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "No se pudo cargar el correo de soporte.");
    }
    const data = await response.json();
    return data.email ?? "";
}

export async function updateSupportEmail(email) {
    const response = await apiFetch(SUPPORT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) await throwApiError(response);
    const data = await response.json();
    return data.email ?? "";
}
