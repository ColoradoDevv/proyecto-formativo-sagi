// Handlers
import { apiFetch, throwApiError } from "@/shared/services/api";

// Mapeo de campos del backend a las keys del formulario (crear y editar usan
// la misma convencion de nombres, compartida por ConsumableForm).
const FIELD_MAP = {
  name: "name",
  description: "description",
  brand_id: "brand",
  inventory_id: "inventory",
  category_id: "category",
  user_id: "cuentadante",
  state: "state",
  unit_price: "unitPrice",
  total_price: "totalPrice",
  purchase_date: "purchaseDate",
  entry_date: "entryDate",
  sena_plate: "senaPlate",
  serial: "serial",
  quantity: "quantity",
  location: "location",
  image: "photo",
  technical_sheet: "technicalSheet",
  quotations: "quotations",
  // El backend acepta una lista de IDs bajo `cuentadante_ids`. Si el backend
  // devuelve un error de validacion con esa clave, lo mostramos en el campo
  // "cuentadante" del formulario.
  cuentadante_ids: "cuentadante",
};

// METODO GET (obtener lista de products)
export async function getCM(signal) {
  const response = await apiFetch("/api/products/consumables/", { signal });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO GET (obtener un products por su ID)
export async function getCMById(id, signal) {
  const response = await apiFetch(`/api/products/consumables/${id}/`, { signal });
  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO POST (crear un nuevo products)
export async function createCm(cmData) {
  const formData = new FormData();

  formData.append("name", cmData.name);
  formData.append("description", cmData.description);
  formData.append("brand_id", cmData.brand);
  formData.append("state", cmData.state);
  formData.append("unit_price", cmData.unitPrice);
  formData.append("total_price", cmData.totalPrice);
  formData.append("purchase_date", cmData.purchaseDate);
  formData.append("entry_date", cmData.entryDate);
  formData.append("is_active", "true");

  // Inventario: opcional. Si llega "", no se manda (backend lo trata como null).
  if (cmData.inventory) formData.append("inventory_id", String(cmData.inventory));
  // Categoria: obligatoria (validado por schema Zod en cliente y por
  // modelo NOT NULL + ValidationError en backend). Siempre se envia.
  if (cmData.category) formData.append("category_id", String(cmData.category));

  // Cuentadantes (M2M): se envian como multiples llaves con el mismo nombre
  // `cuentadante_ids` para que el backend haga .set() sobre el M2M. Si el
  // formulario trae la lista vacia, no se envia la clave.
  if (Array.isArray(cmData.cuentadantes) && cmData.cuentadantes.length > 0) {
    cmData.cuentadantes.forEach((id) => {
      if (id != null && id !== "") formData.append("cuentadante_ids", String(id));
    });
  }

  if (cmData.senaPlate)
    formData.append("sena_plate", cmData.senaPlate);
  if (cmData.serial)
    formData.append("serial", cmData.serial);
  if (cmData.quantity)
    formData.append("quantity", cmData.quantity);
  if (cmData.location)
    formData.append("location", cmData.location);
  if (cmData.photo?.[0])
    formData.append("image", cmData.photo[0]);
  if (cmData.technicalSheet?.[0])
    formData.append("technical_sheet", cmData.technicalSheet[0]);
  // Cotizaciones: IDs elegidos de la biblioteca (quotation_ids repetidos).
  if (Array.isArray(cmData.quotations)) {
    cmData.quotations.forEach((id) => {
      if (id != null && id !== "") formData.append("quotation_ids", String(id));
    });
  }

  const response = await apiFetch("/api/products/consumables/", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO PATCH (editar un products existente)
export async function updateCm(id, cmData) {
  const formData = new FormData();

  formData.append("name", cmData.name);
  formData.append("description", cmData.description);
  formData.append("brand_id", cmData.brand);
  formData.append("state", cmData.state);
  formData.append("unit_price", cmData.unitPrice);
  formData.append("total_price", cmData.totalPrice);
  formData.append("purchase_date", cmData.purchaseDate);
  formData.append("entry_date", cmData.entryDate);

  // Inventario: opcional. "" = no se manda (backend interpreta como null).
  if (cmData.inventory) formData.append("inventory_id", String(cmData.inventory));
  // Categoria: obligatoria (validado por schema Zod). En update se envia
  // siempre que venga en el form; si llega "" se envia cadena vacia para
  // que el backend rechace con ValidationError en vez de quedarse con el
  // valor anterior.
  if (cmData.category !== undefined && cmData.category !== null) {
    formData.append("category_id", String(cmData.category));
  }

  // M2M: solo se envia si el formulario lo incluye (aunque sea array vacio
  // para "ninguno"). El backend interpretara lista vacia como "quitar todos".
  if (Array.isArray(cmData.cuentadantes)) {
    cmData.cuentadantes.forEach((id) => {
      if (id != null && id !== "") formData.append("cuentadante_ids", String(id));
    });
  }

  // Placa SENA/ubicación siempre se mandan (aunque vengan vacías) para que
  // borrarlas en el formulario también las borre en el backend — un
  // FormData con la llave ausente deja el valor anterior intacto en un
  // PATCH parcial. quantity no necesita este tratamiento: el schema no deja
  // llegar aquí con 0/vacío.
  formData.append("sena_plate", cmData.senaPlate ?? "");
  formData.append("location", cmData.location ?? "");
  if (cmData.serial !== undefined)
    formData.append("serial", cmData.serial ?? "");
  if (cmData.quantity)
    formData.append("quantity", cmData.quantity);

  // photo/technicalSheet: File = archivo nuevo, "" = se eliminó
  // explícitamente (el backend lo interpreta como "quitar archivo"),
  // undefined/null = no se tocó, no se manda la llave.
  if (cmData.photo instanceof File || cmData.photo === "")
    formData.append("image", cmData.photo);
  if (cmData.technicalSheet instanceof File || cmData.technicalSheet === "")
    formData.append("technical_sheet", cmData.technicalSheet);
  // Cotizaciones: conciliación total por IDs (los no listados se liberan).
  // Si la lista quedó vacía se manda una llave vacía para que el backend
  // distinga "quitar todas" de "no se tocó el campo".
  if (Array.isArray(cmData.quotations)) {
    if (cmData.quotations.length === 0) formData.append("quotation_ids", "");
    cmData.quotations.forEach((id) => {
      if (id != null && id !== "") formData.append("quotation_ids", String(id));
    });
  }

  const response = await apiFetch(`/api/products/consumables/${id}/`, {
    method: "PATCH",
    body: formData,
  });

  if (!response.ok) await throwApiError(response, FIELD_MAP);
  return response.json();
}

// METODO PATCH (activar o desactivar un material)
export async function toggleCmActive(id, isActive) {
  const response = await apiFetch(`/api/products/consumables/${id}/toggle_active/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function deleteCm(id) {
  const response = await apiFetch(`/api/products/consumables/${id}/`, {
    method: "DELETE",
  });
  if (!response.ok) await throwApiError(response);
}
