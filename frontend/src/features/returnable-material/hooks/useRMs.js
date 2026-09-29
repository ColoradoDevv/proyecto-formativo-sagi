import { useEffect, useState } from "react";
import { getRMs } from "../services/returnableService";

function useRMs() {
    const [RMs, setRMs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRMs = async () => {
            try {
                setLoading(true);
                const data = await getRMs();
                setRMs(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchRMs();
    }, []);

    return { RMs, setRMs, loading, error };
}

export default useRMs;
