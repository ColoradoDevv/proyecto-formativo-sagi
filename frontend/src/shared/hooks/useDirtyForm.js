import { useContext, useEffect, useMemo } from "react";
import { DirtyFormContext } from "../contexts/DirtyFormContext";

const FALLBACK = {
    isDirty: () => false,
    markClean: () => {},
    registerDirty: () => {},
    unregisterDirty: () => {},
};

/**
 * Hook que vincula el ciclo de vida del formulario con el provider global.
 *
 * @param {() => boolean | undefined} dirtyFn  Función que devuelve `true` si
 *   el formulario actual tiene cambios sin guardar respecto a su estado inicial.
 *   Si devuelve `undefined` o no se pasa, se asume `false`.
 */
export function useDirtyForm(dirtyFn) {
    const ctx = useContext(DirtyFormContext);

    useEffect(() => {
        if (!ctx) return undefined;
        if (typeof dirtyFn !== "function") {
            ctx.registerDirty(null);
            return ctx.unregisterDirty;
        }
        ctx.registerDirty(dirtyFn);
        return () => ctx.unregisterDirty();
    }, [ctx, dirtyFn]);
}

/**
 * Acceso de solo lectura al provider. Lo usan Sidenav/Navbar para consultar
 * `isDirty()` antes de cada navegación. Devuelve un fallback seguro si el
 * provider no está montado, así los consumidores no necesitan un guard.
 */
export function useDirtyFormStatus() {
    const fallback = useMemo(() => FALLBACK, []);
    const ctx = useContext(DirtyFormContext);
    return ctx ?? fallback;
}
