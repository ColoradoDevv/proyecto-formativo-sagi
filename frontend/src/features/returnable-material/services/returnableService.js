import { apiFetch, throwApiError } from "@/shared/services/api";

// Mapeo de campos del backend a las keys del formulario. Crear y editar usan
// la misma convencion de nombres, compartida por ReturnableForm.
const FIELD_MAP = {
    name: "name",
    model: "model",
    sena_plate: "senaPlate",
    state: "state",
    brand_id: "brand",
    inventory_id: "inventory",
    category_id: "category",
    serial: "serial",
    unit_price: "unitPrice",
    total_price: "totalPrice",
    description: "description",
    purchase_date: "purchaseDate",
    entry_date: "entryDate",
    quantity: "quantity",
    location: "location",
    image: "photo",
    technical_sheet: "technicalSheet",
    quotations: "quotations",
    // Cuentadantes (M2M): errores bajo `cuentadante_ids` se mapean a
    // `cuentadante` para el formulario.
    cuentadante_ids: "cuentadante",
};

export async function getRMs(search = "") {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const response = await apiFetch(`/api/products/returnables/${query}`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

export async function getRMById(id) {
    const response = await apiFetch(`/api/products/returnables/${id}/`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

export async function createRM(rmData) {
    const formData = new FormData();

    formData.append("name", rmData.name);
    formData.append("model", rmData.model);
    formData.append("sena_plate", rmData.senaPlate);
    formData.append("state", rmData.state);
    formData.append("brand_id", rmData.brand);
    formData.append("category_id", rmData.category);
    formData.append("serial", rmData.serial);
    formData.append("unit_price", rmData.unitPrice);
    formData.append("total_price", rmData.totalPrice);
    formData.append("description", rmData.description);
    formData.append("purchase_date", rmData.purchaseDate);
    formData.append("entry_date", rmData.entryDate);
    // Tipo: nuevo campo enum que define las reglas de placa/dimensiones.
    if (rmData.tipo) formData.append("tipo", rmData.tipo);

    // Inventario: opcional. "" = no se manda.
    if (rmData.inventory) formData.append("inventory_id", String(rmData.inventory));

    if (rmData.quantity)    formData.append("quantity", rmData.quantity);
    if (rmData.location)    formData.append("location", rmData.location);
    if (rmData.photo?.[0])  formData.append("image", rmData.photo[0]);
    // Fichas técnicas: se envían como technical_sheet_0, _1, _2 (hasta 3)
    if (Array.isArray(rmData.technicalSheet)) {
        rmData.technicalSheet.forEach((file, i) => {
            if (file instanceof File) formData.append(`technical_sheet_${i}`, file);
        });
    }
    // Cotizaciones: IDs elegidos de la biblioteca (quotation_ids repetidos).
    if (Array.isArray(rmData.quotations)) {
        rmData.quotations.forEach((id) => {
            if (id != null && id !== "") formData.append("quotation_ids", String(id));
        });
    }

    // Cuentadantes (M2M): si el formulario trae la lista vacia/no la trae,
    // el backend asigna por defecto al usuario actual. Si trae una lista,
    // se envian como claves repetidas `cuentadante_ids`.
    if (Array.isArray(rmData.cuentadantes) && rmData.cuentadantes.length > 0) {
        rmData.cuentadantes.forEach((id) => {
            if (id != null && id !== "") formData.append("cuentadante_ids", String(id));
        });
    }

    // Concatenar dimensiones si existen (formato: "30x50x20")
    if (rmData.width || rmData.length || rmData.depth) {
        const dimensions = `${rmData.width || ""}x${rmData.length || ""}x${rmData.depth || ""}`;
        formData.append("dimensions", dimensions);
    }

    const response = await apiFetch("/api/products/returnables/", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

// METODO PATCH (editar un material devolutivo existente).
export async function updateRM(id, rmData) {
    const formData = new FormData();

    formData.append("name", rmData.name);
    formData.append("model", rmData.model);
    formData.append("sena_plate", rmData.senaPlate);
    formData.append("state", rmData.state);
    formData.append("brand_id", rmData.brand);
    formData.append("category_id", rmData.category);
    formData.append("serial", rmData.serial);
    formData.append("unit_price", rmData.unitPrice);
    formData.append("total_price", rmData.totalPrice);
    formData.append("description", rmData.description);
    formData.append("purchase_date", rmData.purchaseDate);
    formData.append("entry_date", rmData.entryDate);
    formData.append("quantity", rmData.quantity);
    // Tipo: nuevo campo enum que define las reglas de placa/dimensiones.
    if (rmData.tipo !== undefined && rmData.tipo !== null) {
        formData.append("tipo", String(rmData.tipo));
    }

    // Inventario: opcional. "" = no se manda.
    if (rmData.inventory) formData.append("inventory_id", String(rmData.inventory));

    if (rmData.location) formData.append("location", rmData.location);
    if (rmData.photo?.[0]) formData.append("image", rmData.photo[0]);
    // Fichas técnicas nuevas: se envían indexadas para que el backend las agregue
    if (Array.isArray(rmData.technicalSheet)) {
        rmData.technicalSheet.forEach((file, i) => {
            if (file instanceof File) formData.append(`technical_sheet_${i}`, file);
        });
    }
    // Cotizaciones: conciliación total por IDs (las no listadas se liberan).
    // Lista vacía = quitar todas (se manda llave vacía como marca explícita).
    if (Array.isArray(rmData.quotations)) {
        if (rmData.quotations.length === 0) formData.append("quotation_ids", "");
        rmData.quotations.forEach((id) => {
            if (id != null && id !== "") formData.append("quotation_ids", String(id));
        });
    }

    // M2M: solo se envia si el formulario lo incluye. Si llega un array vacio
    // el backend interpretara "quitar todos los cuentadantes".
    if (Array.isArray(rmData.cuentadantes)) {
        rmData.cuentadantes.forEach((id) => {
            if (id != null && id !== "") formData.append("cuentadante_ids", String(id));
        });
    }

    // Concatenar dimensiones si existen (formato: "30x50x20")
    if (rmData.width || rmData.length || rmData.depth) {
        const dimensions = `${rmData.width || ""}x${rmData.length || ""}x${rmData.depth || ""}`;
        formData.append("dimensions", dimensions);
    }
    const response = await apiFetch(`/api/products/returnables/${id}/`, {
        method: "PATCH",
        body: formData,
    });

    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
}

// El toggle de is_active va contra el ConsumableMaterial (donde vive el campo)
export async function toggleRMActive(consumableId, isActive) {
    const response = await apiFetch(`/api/products/returnables/${consumableId}/toggle_active/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

export async function deleteRM(consumableId) {
    const response = await apiFetch(`/api/products/returnables/${consumableId}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
}

export async function deleteTechnicalSheet(sheetId) {
    const response = await apiFetch(`/api/products/technical-sheets/${sheetId}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
}
