import { apiFetch, throwApiError } from "@/shared/services/api";

const FIELD_MAP = {
    id_responsable_user: "loanResponsableUser",
    id_receptor_user: "loanReceptorUser",
    id_material: "loanMaterial",
    amount_lent: "loanMaterialQuantities",
    apprentice_group: "loanGroup",
    justification_use: "loanJustification",
    return_date: "loanReturnDate",
};

export async function getLoans(signal, { limit } = {}) {
    const query = Number.isFinite(limit) && limit > 0 ? `?limit=${Math.min(limit, 50)}` : "";
    const response = await apiFetch(`/api/loans/${query}`, { signal });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

/** Contadores del dashboard en una sola petición (en vez de 4 listados). */
export async function getDashboardSummary(signal) {
    const response = await apiFetch("/api/dashboard/summary/", { signal });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

export async function getLoanById(id) {
    const response = await apiFetch(`/api/loans/${id}/`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

/**
 * Crea un borrador de préstamo y envía los correos de firma a ambas partes.
 * El préstamo real NO se crea en la BD hasta que ambas partes firmen.
 * Devuelve { batch_id, message, draft_count, expires_at }.
 */
export async function createLoanDraft(loanData) {
    const receptorIsRegistered = loanData.receptorIsRegistered !== false;
    const response = await apiFetch("/api/loans/draft/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id_responsable_user: loanData.loanResponsableUser,
            receptor_is_registered: receptorIsRegistered,
            // Registrado: se manda el id del usuario. No registrado: se
            // mandan nombre/correo y el backend crea el préstamo sin FK.
            ...(receptorIsRegistered
                ? { id_receptor_user: loanData.loanReceptorUser }
                : { receptor_name: loanData.receptorName, receptor_email: loanData.receptorEmail }),
            id_material:         loanData.loanMaterial,
            amount_lent:         loanData.loanMaterialQuantities,
            apprentice_group:    loanData.loanGroup,
            loan_type:           loanData.loanType,
            justification_use:   loanData.loanJustification,
            return_date:         loanData.loanReturnDate,
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

/** @deprecated Usar createLoanDraft. Mantenido solo para el flujo de edición de préstamos existentes. */
export async function createLoan(loanData) {
    const response = await apiFetch("/api/loans/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id_responsable_user: loanData.loanResponsableUser,
            id_receptor_user:    loanData.loanReceptorUser,
            id_material:         loanData.loanMaterial,
            amount_lent:         loanData.loanMaterialQuantities,
            apprentice_group:    loanData.loanGroup,
            justification_use:   loanData.loanJustification,
            return_date:         loanData.loanReturnDate,
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

export async function updateLoan(id, loanData) {
    const response = await apiFetch(`/api/loans/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id_responsable_user: loanData.loanResponsableUser,
            id_receptor_user:    loanData.loanReceptorUser,
            id_material:         loanData.loanMaterial,
            amount_lent:         loanData.loanAmount,
            apprentice_group:    loanData.loanGroup,
            justification_use:   loanData.loanJustification,
            return_date:         loanData.loanReturnDate,
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

export async function deleteLoan(id) {
    const response = await apiFetch(`/api/loans/${id}/`, { method: "DELETE" });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
}

// ── Firma sobre préstamos ya existentes (flujo legado) ────────────────────

export async function requestSignOtp(token) {
    const response = await apiFetch("/api/loans/sign/request-otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo enviar el código de verificación.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export async function signLoan(token, otpCode) {
    const response = await apiFetch("/api/loans/sign/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp_code: otpCode }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo procesar la firma.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

// ── Firma sobre borradores (flujo nuevo) ──────────────────────────────────

/** Solicita el OTP para firmar un borrador. El token viene del correo. */
export async function requestDraftSignOtp(token) {
    const response = await apiFetch("/api/loans/draft/sign/request-otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo enviar el código de verificación.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

/** Confirma la firma del borrador con OTP. Cuando ambas partes firman el backend crea el Loans. */
export async function signLoanDraft(token, otpCode) {
    const response = await apiFetch("/api/loans/draft/sign/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp_code: otpCode }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo procesar la firma.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

// ── Firma externa (receptor NO registrado, sin sesión) ─────────────────────
// Usa fetch nativo: sin header Authorization y sin disparar el modal global
// de sesión expirada (apiFetch limpia la sesión ante un 401, lo cual no
// aplica a alguien que firma sin cuenta).
async function publicPost(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo procesar la solicitud.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

/** Solicita el OTP para firmar un borrador como receptor externo (sin sesión). */
export function requestExternalDraftSignOtp(token) {
    return publicPost("/api/loans/draft/sign/request-otp/", { token });
}

/** Confirma la firma del borrador como receptor externo (sin sesión). */
export function signExternalDraft(token, otpCode) {
    return publicPost("/api/loans/draft/sign/", { token, otp_code: otpCode });
}

/** Consulta el estado de firmas de un borrador (para polling). */
export async function getDraftStatus(batchId) {
    const response = await apiFetch(`/api/loans/draft/${batchId}/status/`);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo consultar el estado del borrador.");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

/** Devuelve los préstamos agrupados por lote (batch_id). */
export async function getLoanBatches() {
    const response = await apiFetch("/api/loans/batches/");
    if (!response.ok) await throwApiError(response);
    return response.json();
}
