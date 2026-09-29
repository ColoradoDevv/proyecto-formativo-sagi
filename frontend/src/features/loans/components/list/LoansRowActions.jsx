import { IconButton, cancelAlert, showAlert, usePermissions } from "@/shared";
import { Pencil, Eye, Trash2, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteLoan } from "../../services/loanService";

// Acciones de cada fila de préstamo: editar, visualizar y (si está activo) devolver.
// Sin edit_loan se oculta el lápiz; devolver exige create_return; el borrado
// duro lo reserva el backend al superusuario.
export default function LoansRowActions({ loan, onReturn, onDeleted }) {
    const navigate = useNavigate();
    const { isSuper, can } = usePermissions();
    const canEdit = isSuper || can("edit_loan");
    const canReturn = isSuper || can("create_return");
    const canDelete = isSuper;

    const handleEdit = () => navigate(`/prestamos/editar/${loan.id_loan}`);
    const handleVisualizer = () => navigate(`/prestamos/visualizar/${loan.id_loan}`);
    const handleDelete = async () => {
        const result = await cancelAlert({
            title: "¿Eliminar préstamo?",
            text: "El préstamo será eliminado permanentemente.",
            confirmText: "Sí, eliminar",
            cancelText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteLoan(loan.id_loan);
            onDeleted?.(loan.id_loan);
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Préstamo eliminado correctamente" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo eliminar el préstamo", text: error.message });
        }
    };

    return (
        <div className="flex gap-2">
            {canEdit && (
                <IconButton onClick={handleEdit} variant="ghost" hitSize={32} iconSize={16}>
                    <Pencil size={16} />
                </IconButton>
            )}
            <IconButton onClick={handleVisualizer} variant="ghost" hitSize={32} iconSize={16}>
                <Eye size={16} />
            </IconButton>
            {/* Devolver: solo para préstamos activos y con permiso de devolución */}
            {loan.is_active && onReturn && canReturn && (
                <IconButton
                    onClick={() => onReturn(loan)}
                    variant="ghost"
                    hitSize={32}
                    iconSize={16}
                    ariaLabel="Devolver material"
                >
                    <Undo2 size={16} />
                </IconButton>
            )}
            {canDelete && (
                <IconButton onClick={handleDelete} variant="ghost" hitSize={32} iconSize={16} ariaLabel="Eliminar préstamo">
                    <Trash2 size={16} />
                </IconButton>
            )}
        </div>
    );
}
