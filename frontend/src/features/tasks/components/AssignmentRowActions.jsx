import { IconButton, showAlert, cancelAlert } from "@/shared";
import { Eye, Pencil, Trash2, CircleCheck } from "lucide-react";
import { deleteAssignment } from "../services/taskService";
import { FINISHABLE_STATES } from "../schemas/taskSchema";

// Acciones de cada fila de asignacion de tarea.
// La edicion/eliminacion solo se muestra si el usuario tiene los permisos
// (regla: solo admin/supervisor con edit_task_assignment pueden cambiar
// estados propios o de otros). "Finalizar" lo ve el asignado en tareas
// pendientes/en progreso (el backend valida que sea su tarea).
export default function AssignmentRowActions({
    assignment,
    canEdit,
    canDelete,
    canFinish = false,
    onView,
    onEdit,
    onFinish,
    onDeleted,
}) {

    const handleDelete = async () => {
        const result = await cancelAlert({
            title: "¿Eliminar esta asignacion?",
            text: "La tarea dejara de estar asignada a este usuario.",
            confirmText: "Si, eliminar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteAssignment(assignment.id);
            onDeleted?.(assignment.id);
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Asignacion eliminada" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al eliminar la asignacion", text: error.message });
        }
    };

    return (
        <div className="flex gap-1">
            {canEdit && (
                <IconButton onClick={() => onEdit?.(assignment)} variant="ghost" hitSize={32} iconSize={16} title="Editar">
                    <Pencil size={16} />
                </IconButton>
            )}
            <IconButton onClick={() => onView?.(assignment)} variant="ghost" hitSize={32} iconSize={16} title="Ver">
                <Eye size={16} />
            </IconButton>
            {canFinish && FINISHABLE_STATES.includes(assignment.state) && (
                <IconButton onClick={() => onFinish?.(assignment)} variant="ghost" hitSize={32} iconSize={16} title="Marcar como terminada">
                    <CircleCheck size={16} />
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
