import { useEffect, useState } from "react";
import { getLoanBatches } from "../services/loanService";

export default function useLoanBatches() {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await getLoanBatches();
                setBatches(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return { batches, setBatches, loading, error };
}
