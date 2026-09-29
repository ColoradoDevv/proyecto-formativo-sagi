import { apiFetch } from "@/shared/services/api";

export async function getUsers() {
    const response = await apiFetch("/api/users/");
    const data = await response.json();
    return data.map((user) => ({ id: user.id, label: `${user.first_name} ${user.last_name}` }));
}

export async function getMaterials() {
    const [consumablesRes, returnablesRes] = await Promise.all([
        apiFetch("/api/products/consumables/"),
        apiFetch("/api/products/returnables/"),
    ]);

    const [consumables, returnables] = await Promise.all([
        consumablesRes.json(),
        returnablesRes.json(),
    ]);

    // IDs de materiales que son devolutivos para clasificarlos al mezclar.
    const returnableIds = new Set(returnables.map((r) => r.consumable_id ?? r.consumable));

    return consumables
        .filter((material) => {
            // Excluir materiales agotados (available_quantity definida y <= 0)
            if (material.available_quantity != null && material.available_quantity <= 0) return false;
            return true;
        })
        .map((material) => ({
            id: material.id,
            label: material.available_quantity != null
                ? `${material.name} (${material.available_quantity} disponibles)`
                : material.name,
            available_quantity: material.available_quantity,
            type: returnableIds.has(material.id) ? "Devolutivo" : "Consumo",
        }));
}