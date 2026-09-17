import { useEffect, useState } from "react";
import { getCM } from "../services/consumableService";

function useCMs() {
    const [CMs, setCMs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // AbortController cancela el fetch si el componente se desmonta
        // antes de que la respuesta llegue.
        const controller = new AbortController();

        const fetchCMs = async() => {
            try {
                setLoading(true); // Reinicia el estado de carga si el efecto se vuelve a ejecutar
                const data = await getCM(controller.signal);
                setCMs(data) // Guarda los datos obtenidos
            } catch (err) {
                // AbortError es cancelación intencional — no es un error real.
                if (err.name !== "AbortError") setError(err) // Captura el error si la API falla
            } finally {
                if (!controller.signal.aborted) setLoading(false); // Apaga el indicador de carga
            }
        };

        fetchCMs();

        return () => controller.abort();
    }, []) // Un array vacio para que solo se ejecute al montar el componente

    return { CMs, setCMs, loading, error}
}

export default useCMs;
