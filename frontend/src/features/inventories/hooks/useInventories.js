import { useState, useEffect } from "react";
import { getInventories } from "../services/inventoryService";

export default function useInventories() {
    const [inventories, setInventories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchInventories = async () => {
            try {
                setLoading(true);
                const data = await getInventories();
                setInventories(data);
                setError(null);
            } catch (err) {
                setError(err);
                setInventories([]);
            } finally {
                setLoading(false);
            }
        };

        fetchInventories();
    }, []);

    return { inventories, setInventories, loading, error };
}
