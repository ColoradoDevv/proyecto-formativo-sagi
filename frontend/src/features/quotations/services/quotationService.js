import { apiFetch, throwApiError } from "@/shared/services/api";

// Módulo Cotizaciones: biblioteca de PDFs que luego se asignan a materiales.
// GET acepta { unassigned: true, search: "texto", ordering: "-uploaded_at" }.
export async function getQuotations({ unassigned = false, search = "", ordering = "", signal } = {}) {
    const params = new URLSearchParams();
    if (unassigned) params.set("unassigned", "1");
    if (search.trim()) params.set("search", search.trim());
    if (ordering) params.set("ordering", ordering);
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await apiFetch(`/api/products/quotations/${query}`, { signal });
    if (!response.ok) await throwApiError(response);
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results ?? []);
}

// Detalle de una cotización (para resolver elegidas que el listado
// filtrado no trae, ej. asignadas a este material en edición).
export async function getQuotationById(id, signal) {
    const response = await apiFetch(`/api/products/quotations/${id}/`, { signal });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

// Sube un PDF suelto a la biblioteca (queda sin asignar).
export async function uploadQuotation({ title = "", file }) {
    const formData = new FormData();
    if (title.trim()) formData.append("title", title.trim());
    formData.append("file", file);
    const response = await apiFetch("/api/products/quotations/", {
        method: "POST",
        body: formData,
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

export async function deleteQuotation(id) {
    const response = await apiFetch(`/api/products/quotations/${id}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
}
