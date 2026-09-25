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

//
// Mapa central módulo → codenames EXIGIDOS por el backend.
// Cada vista del backend valida UN codename por acción (ver
// backend/modules/{users,products,loans,tasks}/views.py), así que aquí
// solo figuran esos códigos — no los legacy (list_users, update_*,
// disable_*, export_*) que el backend ya no verifica y que mostraban
// módulos que luego devolvían "Permiso requerido".
//
// Convención:
//   view   — ver listado y detalle del módulo (puerta del sidebar y dashboard)
//   create — formulario de creación (puerta de accesos rápidos)
//   edit   — formulario de edición
//   remove — borrado
//
export const MODULE_PERMS = {
    users: {
        view:   ["view_user"],
        create: ["create_user"],
        edit:   ["edit_user"],
        remove: ["delete_user"],
        export: ["export_users"],
    },
    consumables: {
        view:   ["view_consumable"],
        create: ["create_consumable"],
        edit:   ["edit_consumable"],
        remove: [],
        export: ["export_consumable_materials"],
    },
    returnables: {
        view:   ["view_returnable"],
        create: ["create_returnable"],
        edit:   ["edit_returnable"],
        remove: [],
        export: ["export_returnable_materials"],
    },
    loans: {
        view:   ["view_loan"],
        create: ["create_loan"],
        edit:   ["edit_loan"],
        remove: [],
        export: ["export_loans"],
        // Registrar una devolución (módulo returns).
        createReturn: ["create_return"],
    },
    quotations: {
        view:   ["view_quotation"],
        create: ["create_quotation"],
        edit:   ["edit_quotation"],
        remove: ["delete_quotation"],
        export: [],
    },
    tasks: {
        view:   ["view_task", "view_task_assignment"],
        create: ["create_task", "create_task_assignment"],
        edit:   ["edit_task", "edit_task_assignment"],
        remove: ["delete_task", "delete_task_assignment"],
        export: ["export_tasks", "export_task_assignments"],
    },
    inventories: {
        view:   ["view_inventory"],
        create: ["create_inventory"],
        edit:   ["edit_inventory"],
        remove: ["delete_inventory"],
        export: [],
    },
};

//
// Campana de notificaciones: qué panel puede ver el usuario.
// Son mutuamente excluyentes por grupo/usuario (lo validan el backend y la
// UI de Roles y permisos); el superusuario ve ambos (pestañas).
//
export const NOTIFICATION_PERMS = {
    loans: ["view_loan_notifications"],
    tasks: ["view_task_notifications"],
};

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
