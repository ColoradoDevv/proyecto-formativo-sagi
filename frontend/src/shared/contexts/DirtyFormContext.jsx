import { createContext, useCallback, useMemo, useRef } from "react";

const DirtyFormContext = createContext(null);
export { DirtyFormContext };

/**
 * Provider global. Permite que un único formulario activo (create / edit)
 * registre una función que decide si está "sucio" (tiene datos sin guardar).
 * El SideNav y el avatar del Navbar consultan `isDirty()` antes de permitir
 * una navegación de módulo — si devuelve `true`, muestran `cancelAlert`.
 *
 * Solo se rastrea un formulario a la vez: las rutas Create/Edit están
 * separadas, así que en cualquier momento solo hay un form montado.
 */
export function DirtyFormProvider({ children }) {
    const dirtyRef = useRef(null);

    const registerDirty = useCallback((fn) => {
        dirtyRef.current = typeof fn === "function" ? fn : null;
    }, []);

    const unregisterDirty = useCallback(() => {
        dirtyRef.current = null;
    }, []);

    const markClean = useCallback(() => {
        // Forzar estado limpio: vacía la función de comprobación registrada
        // hasta que el siguiente `useDirtyForm` vuelva a setearla. Útil tras
        // submit/cancel exitoso, justo antes de navegar.
        dirtyRef.current = null;
    }, []);

    const isDirty = useCallback(() => {
        const fn = dirtyRef.current;
        if (!fn) return false;
        try {
            return Boolean(fn());
        } catch {
            return false;
        }
    }, []);

    const value = useMemo(
        () => ({ registerDirty, unregisterDirty, markClean, isDirty }),
        [registerDirty, unregisterDirty, markClean, isDirty]
    );

    return <DirtyFormContext.Provider value={value}>{children}</DirtyFormContext.Provider>;
}
