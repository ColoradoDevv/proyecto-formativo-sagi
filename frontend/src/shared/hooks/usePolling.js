import { useEffect } from "react";

// usePolling
// Ejecuta `reload` cuando `enabled` pasa a true, y lo re-ejecuta cada
// `intervalMs` mientras siga habilitado. Limpia el intervalo automaticamente
// en unmount o cuando `enabled` pasa a false.
//
// Pensado para refrescar datos "en tiempo real" en un panel que el usuario
// tiene abierto (notificaciones, metricas, etc.). Mantener el polling
// apagado cuando el panel esta cerrado evita peticiones en background
// innecesarias.
//
// Uso:
//   const { reload } = useRecentLoans(5);
//   usePolling(reload, { enabled: isOpen, intervalMs: 30000 });
//
// Requisitos:
//   - `reload` debe ser estable entre renders (memorizado). Los hooks de
//     datos del proyecto (useRecentLoans, useTaskAssignments, etc.) lo
//     devuelven envuelto en useCallback para garantizarlo.
export function usePolling(reload, { enabled, intervalMs }) {
    useEffect(() => {
        if (!enabled) return undefined;
        // Disparar inmediatamente para que el primer "open" del panel
        // muestre datos frescos.
        reload?.();
        const id = setInterval(() => reload?.(), intervalMs);
        return () => clearInterval(id);
    }, [reload, enabled, intervalMs]);
}
