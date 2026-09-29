// Opciones del enum `tipo` que llega del backend (ConsumableMaterial.TIPO_CHOICES
// en backend/modules/products/models.py). Mantener en sincronia si el backend
// agrega valores nuevos.
export const RETURNABLE_TIPO_OPTIONS = [
    { id: "herramientas", label: "Herramientas" },
    { id: "maquinaria",   label: "Equipo y Maquinaria" },
    { id: "muebles",      label: "Muebles y Enseres" },
];

// Reglas por tipo: mismas claves que antes dependian del nombre de la
// categoria. `requiresSenaPlate` se exige para maquinaria/muebles;
// `requiresDimensions` solo para muebles.
export function getReturnableTipoRules(tipo) {
    const t = String(tipo || "").trim().toLowerCase();

    if (t === "maquinaria") {
        return {
            requiresSenaPlate: true,
            requiresDimensions: false,
        };
    }
    if (t === "muebles") {
        return {
            requiresSenaPlate: true,
            requiresDimensions: true,
        };
    }
    // Default: "herramientas" o tipo desconocido -> sin reglas.
    return {
        requiresSenaPlate: false,
        requiresDimensions: false,
    };
}

export function getReturnableCategoryOptions(categories = []) {
    // Devuelve todas las categorias disponibles (sin filtrar).
    // La validacion de reglas por categoria se aplica segun el nombre en la validacion.
    return categories;
}

// DEPRECATED: mantenida temporalmente por compat con versiones anteriores de la
// categoria-nombre. Las reglas oficiales ahora viven en `getReturnableTipoRules`
// y dependen del valor del campo `tipo`, no del nombre de la categoria.
export function getReturnableCategoryRules(categoryName = "") {
    const normalized = String(categoryName || "").trim().toLowerCase();

    // `serial` (S/N) ya siempre es opcional, asi que no forma parte de las reglas
    // por categoria — solo mantenemos los flags que si condicionan otros campos.
    if (normalized === "herramienta") {
        return {
            requiresSenaPlate: false,
            requiresDimensions: false,
        };
    }

    if (normalized === "maquinaria y equipos") {
        return {
            requiresSenaPlate: true,
            requiresDimensions: false,
        };
    }

    if (normalized === "muebles y enseres") {
        return {
            requiresSenaPlate: true,
            requiresDimensions: true,
        };
    }

    // Para cualquier otra categoria no reconocida, defaults permisivos
    return {
        requiresSenaPlate: false,
        requiresDimensions: false,
    };
}
