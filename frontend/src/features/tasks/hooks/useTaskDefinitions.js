import { useState, useEffect, useCallback } from "react";
import { getDefinitions } from "../services/taskService";

export default function useTaskDefinitions() {
    const [definitions, setDefinitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getDefinitions();
            setDefinitions(data);
            setError(null);
        } catch (err) {
            setError(err);
            setDefinitions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { definitions, setDefinitions, loading, error, reload };
}
