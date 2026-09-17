//
// Hook reactivo para verificar permisos del usuario autenticado.
// Lee los codenames de sessionStorage y se actualiza si cambian
// (p.ej. tras re-hidratación en ProtectedRoute).
//

import { useState, useEffect, useCallback } from "react";
import { getStoredPermissions, getStoredUser } from "@/shared/services/api";

// Evento interno que disparan setStoredPermissions y ProtectedRoute
// para que todos los componentes que usen este hook se re-rendericen.
export const PERMISSIONS_UPDATED_EVENT = "sia:permissions-updated";

export function usePermissions() {
    const [permissions, setPermissions] = useState(() => getStoredPermissions());
    const [user, setUser]               = useState(() => getStoredUser());

    // Re-lee sessionStorage cada vez que otro módulo emite el evento
    const reload = useCallback(() => {
        setPermissions(getStoredPermissions());
        setUser(getStoredUser());
    }, []);

    useEffect(() => {
        // sessionStorage no dispara "storage" en la misma pestaña,
        // por eso usamos nuestros propios eventos en vez de window.onstorage.
        // "sia:session-updated" cubre cambios al usuario (p.ej. editar perfil);
        // PERMISSIONS_UPDATED_EVENT cubre cambios a los permisos.
        window.addEventListener(PERMISSIONS_UPDATED_EVENT, reload);
        window.addEventListener("sia:session-updated", reload);
        return () => {
            window.removeEventListener(PERMISSIONS_UPDATED_EVENT, reload);
            window.removeEventListener("sia:session-updated", reload);
        };
    }, [reload]);

    const isSuper = user?.is_superuser === true;
    const isPrimaryAdmin = user?.is_primary_admin === true;
    const isAdmin = isSuper || user?.groups?.some(
        (group) => String(group).trim().toUpperCase() === "ADMIN"
    );

    function can(codename) {
        if (isSuper) return true;
        return permissions.includes(codename);
    }

    function canAny(codenames) {
        if (isSuper) return true;
        return codenames.some((c) => permissions.includes(c));
    }

    return { permissions, user, can, canAny, isSuper, isAdmin, isPrimaryAdmin };
}
