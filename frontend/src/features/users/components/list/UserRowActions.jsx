import { useState } from "react";
import { IconButton, cancelAlert, showAlert, usePermissions } from "@/shared";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteUser } from "@/features/users/services/userService"; // ajusta la ruta real

// Acciones por fila de usuario: editar, visualizar y eliminar (borrado logico).
// El cambio de estado (habilitar/deshabilitar) vive en su propia columna (ActiveSwitch).
export default function UserRowActions({ user, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { isSuper, can } = usePermissions();
  const canEdit = isSuper || can("edit_user");
  const canDelete = isSuper || can("delete_user");

  const handleEdit = () => navigate(`/usuarios/editar/${user.id}`);
  const handleVisualizer = () => navigate(`/usuarios/visualizar/${user.id}`);

  const handleDelete = async () => {
    const result = await cancelAlert({
      title: "¿Eliminar usuario?",
      text: `${user.first_name} ${user.last_name} será eliminado del sistema.`,
      confirmText: "Sí, eliminar",
      cancelText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setDeleting(true);
      await deleteUser(user.id);
      onDeleted?.(user.id);

      await showAlert({
        icon: "success",
        iconColor: "var(--color-success)",
        title: "Usuario eliminado exitosamente",
        timer: 4000,
      });
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      await showAlert({
        icon: "error",
        iconColor: "var(--color-error)",
        title: "No se pudo eliminar el usuario",
      });
    } finally {
      setDeleting(false);
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
        <IconButton
          onClick={handleDelete}
          disabled={deleting}
          variant="ghost"
          hitSize={32}
          iconSize={16}
          ariaLabel="Eliminar usuario"
        >
          <Trash2 size={16} />
        </IconButton>
      )}
    </div>
  );
}