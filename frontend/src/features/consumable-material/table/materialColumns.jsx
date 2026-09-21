import { ActiveSwitch, StatusBadge, usePermissions } from "@/shared";
import { joinCuentadantes } from "@/shared/utils/cuentadantes";
import { toggleCmActive } from "../services/consumableService";
import CmRowActions from "../components/list/CmRowActions";

// Sin edit_consumable, el backend rechazaría el PATCH de toggle_active con
// un 403 — mostrar el estado como solo lectura en vez de un switch que
// siempre terminaría fallando (mismo patrón que UserActiveSwitch).
function CmActiveSwitch({ cm, onToggled }) {
    const { isSuper, can } = usePermissions();
    if (!isSuper && !can("edit_consumable")) {
        return <StatusBadge active={cm.is_active} />;
    }
    return (
        <ActiveSwitch
            id={cm.id}
            isActive={cm.is_active}
            toggleFn={toggleCmActive}
            onToggled={onToggled}
        />
    );
}

const EMPTY = "Sin cuentadante";

export const materialColumns = (setCMs) => [
    {
        accessorFn: (row) => joinCuentadantes(row, { emptyPlaceholder: EMPTY }),
        id: "cuentadantes",
        header: "Cuentadantes",
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
        header: "Activo",
        meta: { filterVariant: "select" },
        cell: ({ row }) => (
            <CmActiveSwitch
                cm={row.original}
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
