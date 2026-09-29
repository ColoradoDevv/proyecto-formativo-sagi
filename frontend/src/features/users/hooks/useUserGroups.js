import { useEffect, useState } from "react";
import { getUserGroups } from "../services/selectServices";
import { showAlert } from "@/shared";

// Carga los grupos activos disponibles para los selectores de usuario.
export default function useUserGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        getUserGroups(controller.signal)
            .then((data) => {
                setGroups(data);
                setError(null);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err);
                showAlert({
                    icon: "error",
                    iconColor: "var(--color-error)",
                    title: "No se pudieron cargar los grupos de usuario",
                    text: err.message,
                });
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, []);

    return { groups, loading, error };
}
