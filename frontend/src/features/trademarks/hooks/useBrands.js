import { useState, useEffect } from "react";
import { getBrands } from "../services/brandService";

export default function useBrands() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                setLoading(true);
                const data = await getBrands();
                setBrands(data);
                setError(null);
            } catch (err) {
                setError(err);
                setBrands([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, []);

    return { brands, setBrands, loading, error };
}
