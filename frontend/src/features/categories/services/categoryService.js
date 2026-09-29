import { apiFetch, throwApiError } from "@/shared/services/api";

const FIELD_MAP = {
    name: "categoryName",
    description: "categoryDescription",
};

export const getCategories = async () => {
    const response = await apiFetch("/api/products/categories/");
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const getCategoryById = async (id) => {
    const response = await apiFetch(`/api/products/categories/${id}/`);
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const createCategory = async (categoryData) => {
    const response = await apiFetch("/api/products/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: categoryData.categoryName,
            description: categoryData.categoryDescription ?? "",
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const updateCategory = async (id, categoryData) => {
    const response = await apiFetch(`/api/products/categories/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: categoryData.categoryName,
            description: categoryData.categoryDescription ?? "",
        }),
    });
    if (!response.ok) await throwApiError(response, FIELD_MAP);
    return response.json();
};

export const toggleCategoryActive = async (id, isActive) => {
    const response = await apiFetch(`/api/products/categories/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
};

export const deleteCategory = async (id) => {
    const response = await apiFetch(`/api/products/categories/${id}/`, {
        method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
};
