import { useState, useEffect } from "react";
import { getCategories } from "../services/categoryService";

export default function useCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                const data = await getCategories();
                setCategories(data);
                setError(null);
            } catch (err) {
                setError(err);
                setCategories([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    return { categories, setCategories, loading, error };
}
