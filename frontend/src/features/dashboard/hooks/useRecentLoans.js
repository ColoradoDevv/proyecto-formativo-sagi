import { useEffect, useState, useCallback } from "react";
import { getLoans } from "@/features/loans/services/loanService";

// Trae los prestamos y devuelve los mas recientes para el panel de inicio
// o cualquier vista que necesite un resumen reciente.
// Si limit es 0 (usuario sin permiso) no hace ningún fetch.
// Expone `reload()` para refrescar manualmente (p.ej. al abrir el panel de
// notificaciones para mantener los datos "en tiempo real").
function useRecentLoans(limit = 5) {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(limit > 0);
    const [error, setError] = useState(null);
    // contador que se incrementa para forzar un nuevo fetch via useEffect.
    const [reloadTick, setReloadTick] = useState(0);

    const reload = useCallback(() => {
        setReloadTick((t) => t + 1);
    }, []);

    useEffect(() => {
        // No hacer fetch si no hay permiso (limit === 0)
        if (limit === 0) {
            setLoading(false);
            setLoans([]);
            return;
        }

        // AbortController cancela el fetch si el componente se desmonta o
        // cambia limit/reloadTick, evitando que setState se llame sobre un
        // componente ya desmontado.
        const controller = new AbortController();

        const fetchLoans = async () => {
            try {
                setLoading(true);
                // El backend ya ordena (recientes primero) y recorta.
                const data = await getLoans(controller.signal, { limit });
                setLoans(Array.isArray(data) ? data : []);
                setError(null);
            } catch (err) {
                // AbortError es cancelación intencional — no es un error real.
                // Ignorar tambien errores de sesión expirada: el modal global ya los gestiona.
                if (err.name !== "AbortError" && !err?.silent) setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLoans();

        return () => controller.abort();
    }, [limit, reloadTick]);

    return { loans, loading, error, reload };
}

export default useRecentLoans;
