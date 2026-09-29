import { useEffect, useState } from "react";
import { getRMById } from "../services/returnableService";

function useRm(id) {
    const [RM, setRM] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRM = async () => {
            try {
                setLoading(true);
                const data = await getRMById(id);
                setRM(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchRM();
    }, [id]);

    return { RM, loading, error };
}

export default useRm;
