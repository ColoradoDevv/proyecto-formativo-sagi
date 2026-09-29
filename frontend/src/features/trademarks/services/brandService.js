import { apiFetch, throwApiError } from "@/shared/services/api";

const FIELD_MAP = { name: "brandName" };

export const getBrands = async () => {
    const response = await apiFetch("/api/products/brands/");
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const getBrandById = async (id) => {
    const response = await apiFetch(`/api/products/brands/${id}/`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const createBrand = async (brandData) => {
    const response = await apiFetch("/api/products/brands/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandData.brandName }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const updateBrand = async (id, brandData) => {
    const response = await apiFetch(`/api/products/brands/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandData.brandName }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const toggleBrandActive = async (id, isActive) => {
    const response = await apiFetch(`/api/products/brands/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const deleteBrand = async (id) => {
    const response = await apiFetch(`/api/products/brands/${id}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
};
