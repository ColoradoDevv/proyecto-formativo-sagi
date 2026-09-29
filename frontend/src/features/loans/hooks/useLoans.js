import { useEffect, useState } from "react";
import { getLoans } from "../services/loanService";

function useLoans() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLoans = async () => {
            try {
                setLoading(true);
                const data = await getLoans();
                setLoans(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLoans();
    }, []);

    return { loans, setLoans, loading, error };
}

export default useLoans;
