import LoansRowActions from "../components/list/LoansRowActions";
import LoanStateBadge from "../components/LoanStateBadge";

// Factory: recibe onReturn para que la fila pueda abrir el modal de devolución.
export const loansColumns = ({ onReturn, onDeleted } = {}) => [
    {
        accessorKey: "usuario_responsable",
        header: "Usuario Responsable",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "usuario_receptor",
        header: "Usuario Receptor",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "material",
        header: "Material",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "amount_lent",
        header: "Cantidad",
    },
    {
        accessorKey: "loan_date",
        header: "Fecha de salida",
        meta: { filterVariant: "date" },
    },
    {
        accessorKey: "return_date",
        header: "Fecha Devolución",
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
        cell: ({ row }) => <LoansRowActions loan={row.original} onReturn={onReturn} onDeleted={onDeleted} />,
    },
];
