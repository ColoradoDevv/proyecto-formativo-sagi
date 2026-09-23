import { IconButton, cancelAlert, showAlert, usePermissions } from "@/shared";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteRM } from "../../services/returnableService";

// Acciones de cada fila de material devolutivo: editar y visualizar.
// Sin edit_returnable se oculta el lápiz; el borrado duro lo reserva el
// backend al superusuario (igual que CmRowActions).
export default function RmRowActions({ Rm, onDeleted }) {
    const navigate = useNavigate();
    const { isSuper, can } = usePermissions();
    const canEdit = isSuper || can("edit_returnable");
    const canDelete = isSuper;

    const handleEdit = () => navigate(`/devolutivos/editar/${Rm.consumable_id}`);
    const handleVisualizar = () => navigate(`/devolutivos/visualizar/${Rm.consumable_id}`);
    const handleDelete = async () => {
        const result = await cancelAlert({
            title: "¿Eliminar material devolutivo?",
            text: `El material ${Rm.name} será eliminado permanentemente.`,
            confirmText: "Sí, eliminar",
            cancelText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteRM(Rm.consumable_id);
            onDeleted?.(Rm.consumable_id);
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Material eliminado correctamente" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo eliminar el material", text: error.message });
        }
    };

    return (
        <div className="flex gap-2">
            {canEdit && (
                <IconButton onClick={handleEdit} variant="ghost" hitSize={32} iconSize={16}>
                    <Pencil size={16} />
                </IconButton>
            )}
            <IconButton onClick={handleVisualizar} variant="ghost" hitSize={32} iconSize={16}>
                <Eye size={16} />
            </IconButton>
            {canDelete && (
                <IconButton onClick={handleDelete} variant="ghost" hitSize={32} iconSize={16} ariaLabel="Eliminar material devolutivo">
                    <Trash2 size={16} />
                </IconButton>
            )}
        </div>
    );
}
