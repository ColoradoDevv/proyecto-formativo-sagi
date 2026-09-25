/**
 * Compara dos valores para detectar cambios "significativos" en un formulario.
 * Se considera sucio si existe alguna diferencia entre `current` y `initial`.
 *
 * Reglas:
 * - Tipos primitivos: comparación estricta.
 * - Strings: se ignoran diferencias que sean solo espacios (`""` y `"   "`
 *   cuentan como equivalentes a `""`). Esto evita falsos positivos al pegar
 *   un valor y borrarlo dejando solo espacios.
 * - Arrays: comparación por orden y elementos (JSON).
 * - Objetos: comparación profunda de claves presentes en `initial` (no se
 *   añaden claves nuevas, sino que se mira valor por valor).
 *
 * Si se pasa `ignoreKeys`, esas claves no participan en la comparación
 * (útil para campos autogenerados tipo `loanResponsableUser` precargados).
 */
export default function isFormDirty(current, initial, ignoreKeys = []) {
    if (current === initial) return false;
    if (current == null || initial == null) {
        return Boolean(current) !== Boolean(initial);
    }

    if (typeof current !== typeof initial) return true;

    if (Array.isArray(current) || Array.isArray(initial)) {
        return JSON.stringify(safeNormalize(current)) !== JSON.stringify(safeNormalize(initial));
    }

    if (typeof current === "object") {
        const ignored = new Set(ignoreKeys);
        const keys = new Set([
            ...Object.keys(current || {}),
            ...Object.keys(initial || {}),
        ]);
        for (const key of keys) {
            if (ignored.has(key)) continue;
            const c = current?.[key];
            const i = initial?.[key];
            if (isPrimitiveDiff(c, i)) return true;
        }
        return false;
    }

    return isPrimitiveDiff(current, initial);
}

function isPrimitiveDiff(a, b) {
    if (typeof a === "string" && typeof b === "string") {
        return a.trim() !== b.trim();
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return JSON.stringify(a) !== JSON.stringify(b);
    }
    return a !== b;
}

function safeNormalize(v) {
    try {
        return JSON.parse(JSON.stringify(v));
    } catch {
        return v;
    }
}
