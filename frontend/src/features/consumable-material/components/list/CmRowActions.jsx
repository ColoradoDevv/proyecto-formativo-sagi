import { IconButton, cancelAlert, showAlert, usePermissions } from "@/shared";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteCm } from "../../services/consumableService";

// Acciones de cada fila de material de consumo: editar y visualizar.
// El cambio de estado (habilitar/deshabilitar) vive en su propia columna (ActiveSwitch).
export default function CmRowActions({ cm, onDeleted }) {
    const navigate = useNavigate();
    const { isSuper, can } = usePermissions();
    const canEdit = isSuper || can("edit_consumable");
    // Eliminar (borrado duro) sigue exigiendo superusuario en el backend —
    // no hay un codename dedicado para esta acción, a diferencia de editar.
    const canDelete = isSuper;

    const handleEdit = () => navigate(`/consumibles/editar/${cm.id}`);
    const handleVisualizer = () => navigate(`/consumibles/visualizar/${cm.id}`);
    const handleDelete = async () => {
        const result = await cancelAlert({
            title: "¿Eliminar material?",
            text: `El material ${cm.name} será eliminado permanentemente.`,
            confirmText: "Sí, eliminar",
            cancelText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteCm(cm.id);
            onDeleted?.(cm.id);
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
            <IconButton onClick={handleVisualizer} variant="ghost" hitSize={32} iconSize={16}>
                <Eye size={16} />
            </IconButton>
            {canDelete && (
                <IconButton onClick={handleDelete} variant="ghost" hitSize={32} iconSize={16} ariaLabel="Eliminar material">
                    <Trash2 size={16} />
                </IconButton>
            )}
        </div>
    );
}
