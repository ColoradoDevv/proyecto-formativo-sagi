import { useNavigate } from "react-router-dom";
import { IconButton, usePermissions } from "@/shared";
import { Eye, Undo2 } from "lucide-react";
import LoanStateBadge from "../components/LoanStateBadge";

// Celda de acciones extraída como componente para poder usar hooks.
// Devolver exige create_return (misma puerta que la ruta lote/:batchId/devolver).
function BatchRowActions({ batch }) {
    const navigate = useNavigate();
    const { isSuper, can } = usePermissions();
    const canReturn = isSuper || can("create_return");
    const detailTarget = batch.batch_id
        ? `/prestamos/lote/${batch.batch_id}`
        : `/prestamos/visualizar/${batch.loans?.[0]?.id_loan}`;
    const returnTarget = batch.batch_id
        ? `/prestamos/lote/${batch.batch_id}/devolver`
        : null;
    return (
        <div className="flex gap-2">
            <IconButton
                variant="ghost"
                hitSize={32}
                iconSize={16}
                ariaLabel="Ver detalle del lote"
                onClick={() => navigate(detailTarget)}
            >
                <Eye size={16} />
            </IconButton>

            {batch.is_active && canReturn && returnTarget && (
                <IconButton
                    variant="ghost"
                    hitSize={32}
                    iconSize={16}
                    ariaLabel="Devolver materiales del lote"
                    onClick={() => navigate(returnTarget)}
                >
                    <Undo2 size={16} />
                </IconButton>
            )}
        </div>
    );
}

export const batchColumns = () => [
    {
        accessorKey: "usuario_responsable",
        header: "Responsable",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "usuario_receptor",
        header: "Receptor",
        meta: { filterVariant: "select" },
        cell: ({ row }) => (
            <div className="flex flex-col min-w-0">
                <span className="truncate">{row.original.usuario_receptor}</span>
                <span className="text-small text-text-muted truncate">
                    Doc: {row.original.receptor_document ?? "—"}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "apprentice_group",
        header: "Grupo / Ficha",
    },
    {
        id: "materiales",
        header: "Materiales",
        accessorFn: (row) => row.loans.map((l) => l.material).join(", "),
        cell: ({ row }) => {
            const loans = row.original.loans;
            return (
                <div className="flex flex-wrap gap-1">
                    {loans.map((l) => (
                        <span
                            key={l.id_loan}
                            className="inline-flex items-center gap-1 text-small px-2 py-0.5 rounded-full border border-border bg-surface-muted text-text-secondary"
                        >
                            {l.material}
                            <span className="text-text-muted">×{l.amount_lent}</span>
                        </span>
                    ))}
                </div>
            );
        },
    },
    {
        accessorKey: "loan_date",
        header: "Fecha de salida",
        meta: { filterVariant: "date" },
    },
    {
        accessorKey: "return_date",
        header: "Fecha devolución",
        meta: { filterVariant: "date" },
    },
    {
        accessorKey: "state",
        header: "Estado",
        meta: { filterVariant: "select" },
        cell: ({ row }) => <LoanStateBadge state={row.original.state} />,
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => <BatchRowActions batch={row.original} />,
    },
];
