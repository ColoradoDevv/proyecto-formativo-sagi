// Servicios compartidos de selects (lista de opciones para selects y
// dropdowns). Antes vivian duplicados en features/consumable-material y
// features/returnable-material; consolidados aqui para que cualquier
// cambio en endpoint/filtros se aplique a todas las features.
//
// Convenciones:
//   - Todas las funciones GET aceptan un `signal` opcional para soportar
//     AbortController y cancelar fetches cuando el componente se desmonta.
//   - El `id` se devuelve como STRING para encajar directo en <Select> y
//     <SelectMultiple> (que comparan strings contra `formData.<key>`).

import { apiFetch } from "./api";

const USERS_LABELLED_ENDPOINT = "/api/users/?is_accountable=true&is_active=true";

function toOption(item, { idAsString = true } = {}) {
    return {
        id: idAsString ? String(item.id) : item.id,
        label: item.name ?? "",
    };
}

function userToOption(user) {
    const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    return { id: String(user.id), label: full || user.email || `Usuario #${user.id}` };
}

// Marcas activas. Filtra inactivas para que no aparezcan en los formularios.
export async function getBrands(signal) {
    const response = await apiFetch("/api/products/brands/", { signal });
    const data = await response.json();
    return data
        .filter((brand) => brand.is_active)
        .map((b) => toOption(b));
}

// Crea una marca nueva y devuelve la opcion lista para el select.
export async function createBrand(name) {
    const response = await apiFetch("/api/products/brands/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.name?.[0] || data.detail || "No se pudo crear la marca");
    }
    const brand = await response.json();
    return toOption(brand);
}

// Categorias activas (catalogo compartido entre consumibles y devolutivos).
// Filtra inactivas para que no aparezcan en los formularios. La gestion
// completa (CRUD) vive en la pestana Categorias de Configuracion.
export async function getCategories(signal) {
    const response = await apiFetch("/api/products/categories/", { signal });
    const data = await response.json();
    return data
        .filter((c) => c.is_active)
        .map((c) => toOption(c));
}

// Crea una categoria nueva y devuelve la opcion lista para el select
// (id como string). Pensado para uso futuro desde CreateOptionButton en
// formularios; el CRUD principal hoy vive en la pestana Categorias.
export async function createCategory(name) {
    const response = await apiFetch("/api/products/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.name?.[0] || data.detail || "No se pudo crear la categoria");
    }
    const cat = await response.json();
    return toOption(cat);
}

// Estados operativos de un material (devolutivo o consumible). Lista
// hardcodeada que coincide con STATE_CHOICES en backend.
export function getStates() {
    return Promise.resolve([
        { id: "Disponible",    label: "Disponible"     },
        { id: "No Disponible", label: "No Disponible"  },
        { id: "Mantenimiento", label: "Mantenimiento"  },
        { id: "Traslado",      label: "Traslado"       },
        { id: "En prestamo",   label: "En prestamo"    },
        { id: "Baja",          label: "Baja"           },
    ]);
}

// Usuarios activos marcados como cuentadantes (mismo filtro que el
// selector de "Cuentadante" en los formularios de materiales).
export async function getUsers(signal) {
    const response = await apiFetch(USERS_LABELLED_ENDPOINT, { signal });
    const data = await response.json();
    return data.map(userToOption);
}

// Nombres de inventario activos (catalogo Inventarios).
// Se filtra por `is_active=true` para que los inactivos no aparezcan en los
// formularios de materiales. Quien quiera administrarlos va a la pestaña
// Inventarios, que consume useInventories directamente.
export async function getInventories(signal) {
    const response = await apiFetch("/api/products/inventories/", { signal });
    const data = await response.json();
    return data
        .filter((inv) => inv.is_active)
        .map((inv) => toOption(inv));
}

// Crea un nombre de inventario nuevo y devuelve la opcion lista para
// el select (id como string). Pensado para uso futuro desde CreateOptionButton
// en formularios; el CRUD principal hoy vive en la pestaña Inventarios.
export async function createInventory(name) {
    const response = await apiFetch("/api/products/inventories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.name?.[0] || data.detail || "No se pudo crear el nombre de inventario");
    }
    const inv = await response.json();
    return toOption(inv);
}
