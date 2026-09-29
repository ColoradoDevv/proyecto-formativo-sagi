import { useState, useEffect } from "react";
import { getBrandById } from "../services/brandService";

export default function useBrand(id) {
    const [brand, setBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBrand = async () => {
            try {
                setLoading(true);
                const data = await getBrandById(id);
                setBrand(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBrand();
    }, [id]);

    return { brand, loading, error };
}
