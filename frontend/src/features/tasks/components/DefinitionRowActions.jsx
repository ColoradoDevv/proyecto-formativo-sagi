import { IconButton, showAlert, cancelAlert } from "@/shared";
import { Eye, Pencil, Trash2, Users } from "lucide-react";
import { deleteDefinition } from "../services/taskService";

// Acciones de cada fila de definicion de tarea.
export default function DefinitionRowActions({
    definition,
    canEdit = true,
    canDelete,
    onView,
    onEdit,
    onDeleted,
    onManage,
}) {

    const handleDelete = async () => {
        const result = await cancelAlert({
            title: "¿Eliminar esta tarea?",
            text: "Se eliminaran tambien todas las asignaciones asociadas.",
            confirmText: "Si, eliminar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteDefinition(definition.id);
            onDeleted?.(definition.id);
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Tarea eliminada" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al eliminar la tarea", text: error.message });
        }
    };

    return (
        <div className="flex gap-1">
            {canEdit && (
                <IconButton onClick={() => onEdit?.(definition)} variant="ghost" hitSize={32} iconSize={16} title="Editar">
                    <Pencil size={16} />
                </IconButton>
            )}
            <IconButton onClick={() => onView?.(definition)} variant="ghost" hitSize={32} iconSize={16} title="Ver">
                <Eye size={16} />
            </IconButton>
            {onManage && (
                <IconButton onClick={() => onManage?.(definition)} variant="ghost" hitSize={32} iconSize={16} title="Asignaciones">
                    <Users size={16} />
                </IconButton>
            )}
            {canDelete && (
                <IconButton onClick={handleDelete} variant="ghost" hitSize={32} iconSize={16} title="Eliminar">
                    <Trash2 size={16} />
                </IconButton>
            )}
        </div>
    );
}
