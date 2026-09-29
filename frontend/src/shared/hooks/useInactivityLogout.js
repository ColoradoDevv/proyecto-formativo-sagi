import { useEffect, useRef } from "react";
import { clearSession, isAuthenticated } from "@/shared/services/api";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora
const CHECK_INTERVAL_MS     = 30 * 1000;       // revisar cada 30 s
const STORAGE_KEY           = "sia_last_activity";

/**
 * Hook que cierra la sesión automáticamente tras 1 hora de inactividad.
 *
 * "Actividad" se define como cualquier interacción del usuario:
 * mousemove, keydown, click, scroll o touchstart.
 *
 * Al detectar inactividad:
 *   1. Limpia la sesión (clearSession).
 *   2. Dispara el evento sia:session-expired para que SessionExpiredModal
 *      muestre el aviso al usuario.
 *
 * Se usa sessionStorage para que múltiples pestañas compartan el timestamp
 * de última actividad — si el usuario está activo en otra pestaña, esta
 * no lo desconecta.
 */
export function useInactivityLogout() {
    const intervalRef = useRef(null);

    useEffect(() => {
        // Registrar actividad: actualiza el timestamp en sessionStorage.
        const recordActivity = () => {
            sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
        };

        // Inicializar con la hora actual al montar.
        recordActivity();

        const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];
        EVENTS.forEach((e) => window.addEventListener(e, recordActivity, { passive: true }));

        // Comprobar periódicamente si el usuario lleva demasiado tiempo inactivo.
        intervalRef.current = setInterval(() => {
            if (!isAuthenticated()) return; // ya está desconectado

            const last = parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10);
            const elapsed = Date.now() - last;

            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
                clearSession();
                window.dispatchEvent(new CustomEvent("sia:session-expired"));
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            EVENTS.forEach((e) => window.removeEventListener(e, recordActivity));
            clearInterval(intervalRef.current);
        };
    }, []);
}
