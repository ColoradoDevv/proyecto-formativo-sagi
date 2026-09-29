import { useEffect, useState } from "react";
import { getUserById } from "../services/userService";

function useUser(id) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // AbortController cancela el fetch si el componente se desmonta o cambia id,
        // evitando que setState se llame sobre un componente ya desmontado.
        const controller = new AbortController();

        const fetchUser = async () => {
            try {
                setLoading(true);
                const data = await getUserById(id, controller.signal);
                setUser(data);
            } catch (err) {
                // AbortError es cancelación intencional — no es un error real.
                if (err.name !== "AbortError") setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();

        return () => controller.abort();
    }, [id]);

    return { user, loading, error };
}

export default useUser;
