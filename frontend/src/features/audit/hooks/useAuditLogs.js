import { useEffect, useState, useCallback, useRef } from "react";
import { getAuditLogs } from "../services/auditService";

/**
 * Hook que obtiene el historial de auditoría del backend.
 *
 * - `filters`: objeto con los parámetros de búsqueda/filtrado.
 *   Cualquier cambio en filters dispara un nuevo fetch.
 * - Devuelve { logs, loading, error, refetch }.
 */
function useAuditLogs(filters = {}) {
    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    // Serializar filters para comparar en el effect sin dependencia de objeto.
    const filtersKey = JSON.stringify(filters);
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    const fetchLogs = useCallback(async (signal) => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAuditLogs(filtersRef.current, signal);
            // La API devuelve array directo (sin paginación de DRF) o
            // { results: [...] } si se activa PageNumberPagination.
            setLogs(Array.isArray(data) ? data : (data.results ?? []));
        } catch (err) {
            if (err.name !== "AbortError" && !err.silent) setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchLogs(controller.signal);
        return () => controller.abort();
    }, [fetchLogs, filtersKey]); // re-fetch cuando cambian los filtros

    return { logs, loading, error, refetch: () => fetchLogs() };
}

export default useAuditLogs;
