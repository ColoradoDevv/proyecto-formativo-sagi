// Utilidades para presentar "cuentadantes" (M2M) en celdas de tabla,
// reportes y otros lugares donde se quiera mostrar la lista de
// responsables de un material como texto.
//
// El backend expone `row.cuentadantes` como lista de objetos
// `{ id, first_name, last_name }`. Por compat, si la lista no esta presente
// pero viene `row.user` (singular, primer cuentadante legado), caemos a ese
// valor para no perder el dato.

const EMPTY_PLACEHOLDER_DEFAULT = "-";

// Une los nombres de los cuentadantes de una fila en una sola cadena.
// Opciones:
//   - `emptyPlaceholder` (default "-"): texto a mostrar cuando no hay
//     cuentadantes. Las tablas suelen preferir "Sin cuentadante".
export function joinCuentadantes(row, { emptyPlaceholder = EMPTY_PLACEHOLDER_DEFAULT } = {}) {
    if (!row) return emptyPlaceholder;
    const cuentas = Array.isArray(row.cuentadantes)
        ? row.cuentadantes
        : (row.user ? [row.user] : []);
    if (!cuentas.length) return emptyPlaceholder;
    return cuentas
        .map((u) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim())
        .filter(Boolean)
        .join(", ");
}

// Acceso rapido al array de objetos "usuario" de una fila, normalizando
// compat con `row.user`. Util cuando necesitas iterar o contar en lugar
// de unir nombres.
export function getCuentadantes(row) {
    if (!row) return [];
    if (Array.isArray(row.cuentadantes)) return row.cuentadantes;
    return row.user ? [row.user] : [];
}
