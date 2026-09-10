import { ActiveSwitch } from "@/shared";
import { toggleCmActive } from "../services/consumableService";
import CmRowActions from "../components/list/CmRowActions";

export const materialColumns = (setCMs) => [
    {
        accessorFn: (row) => row.user ? `${row.user.first_name} ${row.user.last_name}` : "Sin cuentadante",
        id: "user",
        header: "Cuentadante",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "name",
        header: "Nombre del material",
    },
    {
        accessorKey: "quantity",
        header: "Cantidad disponible",
        cell: ({ row }) => {
            const { available_quantity, quantity, is_exhausted } = row.original;
            const display = available_quantity ?? quantity;
            if (display == null) return "—";
            return (
                <span className="flex items-center gap-1.5">
                    {display}
                    {is_exhausted && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-error/15 text-error border border-error/30">
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
        cell: ({ row }) => {
            const { state, is_exhausted } = row.original;
            return (
                <span className="flex items-center gap-1.5">
                    {state ?? "—"}
                    {is_exhausted && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-error/15 text-error border border-error/30">
                            Agotado
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        accessorKey: "location",
        header: "Ubicación",
    },
    {
        accessorKey: "purchase_date",
        header: "Fecha de compra",
        meta: { filterVariant: "date" },
    },
    {
        accessorFn: (row) => row.is_active ? "Activo" : "Inactivo",
        id: "is_active",
        header: "Estado",
        meta: { filterVariant: "select" },
        cell: ({ row }) => (
            <ActiveSwitch
                id={row.original.id}
                isActive={row.original.is_active}
                toggleFn={toggleCmActive}
                onToggled={(updatedMaterial) => {
                    setCMs((prev) => prev.map((item) =>
                        item.id === row.original.id
                            ? { ...item, is_active: updatedMaterial.is_active, state: updatedMaterial.state }
                            : item
                    ));
                }}
            />
        ),
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => <CmRowActions cm={row.original} onDeleted={(id) => setCMs((prev) => prev.filter((item) => item.id !== id))} />,
    },
];
