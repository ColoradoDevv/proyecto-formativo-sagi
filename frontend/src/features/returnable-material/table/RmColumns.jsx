import { Switch, StatusBadge, usePermissions } from "@/shared";
import { joinCuentadantes } from "@/shared/utils/cuentadantes";
import RmRowActions from "../components/list/RmRowActions";
import { toggleRMActive } from "../services/returnableService";

const EMPTY = "Sin cuentadante";

// Sin edit_returnable, el backend rechazaría el PATCH de toggle_active con
// un 403 — mostrar el estado como solo lectura en vez de un switch que
// siempre terminaría fallando (mismo patrón que CmActiveSwitch).
function RmActiveSwitch({ rm, onChange }) {
    const { isSuper, can } = usePermissions();
    if (!isSuper && !can("edit_returnable")) {
        return <StatusBadge active={rm.is_active} />;
    }
    return (
        <Switch
            checked={rm.is_active}
            onChange={onChange}
            className="inline-flex"
        />
    );
}

export const RmColumns = (setRMs, setNotification) => [
    {
        accessorKey: "name",
        header: "Nombre",
    },
    {
        accessorKey: "quantity",
        header: "Cantidad disponible",
        cell: ({ row }) => {
            const { available_quantity, quantity, is_exhausted } = row.original;
            // Mostrar cantidad disponible si existe, si no el total
            const display = available_quantity ?? quantity;
            if (display == null) return "—";
            return (
                <span className="flex items-center gap-1.5">
                    {display}
                    {is_exhausted && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-small font-medium bg-error/15 text-error border border-error/30">
                            Agotado
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        accessorKey: "state",
        header: "Disponibilidad",
        meta: { filterVariant: "select" },
    },
    {
        id: "category",
        header: "Categoría",
        accessorFn: (row) => row.category?.name ?? "—",
        meta: { filterVariant: "select" },
    },
    {
        id: "cuentadantes",
        header: "Cuentadantes",
        accessorFn: (row) => joinCuentadantes(row, { emptyPlaceholder: EMPTY }),
        meta: { filterVariant: "select" },
        cell: ({ row }) => {
            const text = joinCuentadantes(row.original, { emptyPlaceholder: EMPTY });
            const isEmpty = text === EMPTY;
            return (
                <span
                    className={`block max-w-xs truncate ${isEmpty ? "text-text-muted" : ""}`}
                    title={text}
                >
                    {text}
                </span>
            );
        },
    },
    {
        id: "brand",
        header: "Marca",
        accessorFn: (row) => row.brand?.name ?? "—",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "serial",
        header: "Serial",
    },
    {
        accessorFn: (row) => row.is_active ? "Activo" : "Inactivo",
        id: "is_active",
        header: "Estado",
        meta: { filterVariant: "select" },
        cell: ({ row }) => {
            const rm = row.original;

            const handleChange = async (value) => {
                try {
                    const updatedMaterial = await toggleRMActive(rm.consumable_id, value);
                    setRMs((prev) =>
                        prev.map((item) =>
                            item.consumable_id === rm.consumable_id
                                ? {
                                    ...item,
                                    is_active: updatedMaterial.is_active,
                                    state: updatedMaterial.state,
                                }
                                : item
                        )
                    );
                    setNotification({ severity: "success", message: "Estado actualizado." });
                } catch {
                    setNotification({ severity: "error", message: "Error al actualizar estado." });
                }
            };

            return (
                <RmActiveSwitch rm={rm} onChange={handleChange} />
            );
        },
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => <RmRowActions Rm={row.original} onDeleted={(id) => setRMs((prev) => prev.filter((item) => item.consumable_id !== id))} />,
    },
];
