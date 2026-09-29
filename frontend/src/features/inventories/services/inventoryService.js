import { apiFetch, throwApiError } from "@/shared/services/api";

const FIELD_MAP = {
    name: "inventoryName",
    description: "inventoryDescription",
};

export const getInventories = async () => {
    const response = await apiFetch("/api/products/inventories/");
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const getInventoryById = async (id) => {
    const response = await apiFetch(`/api/products/inventories/${id}/`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const createInventory = async (inventoryData) => {
    const response = await apiFetch("/api/products/inventories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: inventoryData.inventoryName,
            description: inventoryData.inventoryDescription ?? "",
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const updateInventory = async (id, inventoryData) => {
    const response = await apiFetch(`/api/products/inventories/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: inventoryData.inventoryName,
            description: inventoryData.inventoryDescription ?? "",
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const toggleInventoryActive = async (id, isActive) => {
    const response = await apiFetch(`/api/products/inventories/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
};

export const deleteInventory = async (id) => {
    const response = await apiFetch(`/api/products/inventories/${id}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
};
