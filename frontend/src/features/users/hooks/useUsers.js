import { useEffect, useState, useCallback, useRef } from "react";
import { getUsers } from "../services/userService";

function useUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Guarda el controller del fetch en curso para poder cancelarlo si se
    // llama a refetch() de nuevo (p.ej. tras eliminar) o si el componente
    // se desmonta antes de que la respuesta llegue.
    const controllerRef = useRef(null);

    const fetchUsers = useCallback(async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        try {
            setLoading(true); // Reinicia el estado de carga si el efecto se vuelve a ejecutar
            const data = await getUsers(controller.signal);
            setUsers(data); // Guarda los datos obtenidos
            setError(null);
        } catch (err) {
            // AbortError es cancelación intencional — no es un error real.
            if (err.name !== "AbortError") setError(err); // Captura el error si la API falla
        } finally {
            if (!controller.signal.aborted) setLoading(false); // Apaga el indicador de carga
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        return () => controllerRef.current?.abort();
    }, [fetchUsers]); // Se ejecuta al montar el componente

    // refetch permite volver a pedir los datos manualmente
    // (por ejemplo, despues de eliminar un usuario)
    return { users, loading, error, refetch: fetchUsers };
}

export default useUsers;
