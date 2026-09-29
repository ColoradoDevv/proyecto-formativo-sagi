import { useEffect, useState } from "react";
import { getLoanById } from "../services/loanService";

function useLoan(id) {
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLoan = async () => {
            try {
                setLoading(true);
                const data = await getLoanById(id);
                setLoan(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLoan();
    }, [id]);

    return { loan, loading, error };
}

export default useLoan;
