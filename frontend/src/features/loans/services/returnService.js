import { apiFetch, throwApiError } from "@/shared/services/api";

// Mapea los campos del backend a las keys del formulario de devolucion,
// para mostrar el error de validacion junto al input correcto.
const FIELD_MAP = {
    loan: "loanId",
    leftover_quantity: "leftoverQuantity",
    returned_quantity: "returnedQuantity",
    observations: "observations",
};

// METODO POST - registra la devolucion de un prestamo.
// - consumo: se envia leftover_quantity (sobrante).
// - devolutivo: se envia returned_quantity (cantidad devuelta).
export async function returnLoan({ loanId, leftoverQuantity, returnedQuantity, observations, materialCondition }) {
    const body = {
        loan: loanId,
        observations: observations ?? "",
        material_condition: materialCondition ?? "Bueno",
    };
    if (leftoverQuantity !== undefined && leftoverQuantity !== null && leftoverQuantity !== "") {
        body.leftover_quantity = Number(leftoverQuantity);
    }
    if (returnedQuantity !== undefined && returnedQuantity !== null && returnedQuantity !== "") {
        body.returned_quantity = Number(returnedQuantity);
    }

    const response = await apiFetch("/api/returns/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}
