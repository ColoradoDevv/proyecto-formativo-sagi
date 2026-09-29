import { Navigate, useParams } from "react-router-dom";
import { getStoredUser } from "@/shared/services/api";
import { usePermissions } from "@/shared";
import UserDetailView from "../../components/detail/UserDetailView";

export default function UserDetailPage() {
    const { id } = useParams();
    const currentUser = getStoredUser();
    const { isSuper, can } = usePermissions();
    // Puerta por PERMISO (no por nombre de grupo): con view_user se puede
    // visualizar cualquier usuario; sin él, solo el perfil propio.
    // El botón "Editar" dentro de UserDetailView sigue exigiendo edit_user.
    const canView = isSuper || can("view_user");
    const isOwnProfile = String(currentUser?.id) === String(id);

    // El guard se ejecuta antes de montar UserDetailView, evitando incluso la
    // consulta de datos de otra cuenta desde una URL escrita manualmente.
    if (!canView && !isOwnProfile) {
        return <Navigate to="/" replace />;
    }

    return <UserDetailView />;
}
