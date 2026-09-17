import { useEffect, useState } from "react";
import { getCMById } from "../services/consumableService";

function useCm(id) {
    const [CM, setCM] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // AbortController cancela el fetch si el componente se desmonta o
        // cambia id, evitando que setState se llame sobre un componente ya
        // desmontado.
        const controller = new AbortController();

        const fetchCMs = async() => {
            try {
                setLoading(true); // Reinicia el estado de carga si el efecto se vuelve a ejecutar
                const data = await getCMById(id, controller.signal);
                setCM(data) // Guarda los datos obtenidos
            } catch (err) {
                // AbortError es cancelación intencional — no es un error real.
                if (err.name !== "AbortError") setError(err) // Captura el error si la API falla
            } finally {
                if (!controller.signal.aborted) setLoading(false); // Apaga el indicador de carga
            }
        };

        fetchCMs();

        return () => controller.abort();
    }, [id]) // Un array con `id` para que se ejecute cuando cambie

    return { CM, loading, error}
}

export default useCm;
