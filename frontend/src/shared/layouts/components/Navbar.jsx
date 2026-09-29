import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/shared/hooks/usePermissions";
import { mediaUrl } from "@/shared/services/api";
import { cancelAlert } from "@/shared";
import { useDirtyFormStatus } from "@/shared";
import ThemeToggle from "@/shared/components/ThemeToggle";
import NotificationsBell from "./NotificationsBell";
import senaLogoVerde from "@/assets/images/sena/logo-sena-verde.svg";
import senaLogoBlanco from "@/assets/images/sena/logo-sena-blanco.svg";


export default function Navbar({ onToggleSidebar }) {

    const navigate = useNavigate();
    // usePermissions() expone el usuario de forma reactiva (se refresca solo
    // con sia:session-updated) — a diferencia de leer getStoredUser()
    // directamente, así el avatar se actualiza sin recargar la página al
    // cambiar la foto de perfil desde "Mi perfil".
    const { user } = usePermissions();
    const { isDirty } = useDirtyFormStatus();
    const userName = user?.first_name ?? "Usuario";
    const userInitial = (user?.first_name?.[0] ?? "U").toUpperCase();

    const handleMenuClick = () => {
        if (onToggleSidebar) onToggleSidebar();
        window.dispatchEvent(new Event("toggle-sidebar-collapse"));
    };

    // El avatar navega a /configuracion; si hay un formulario sucio montado,
    // mostramos el mismo modal de cancelación que usa el SideNav.
    const handleProfileClick = async (e) => {
        if (!isDirty()) return;
        e.preventDefault();
        const result = await cancelAlert();
        if (result.isConfirmed) navigate("/configuracion");
    };

    return (
        <nav className="bg-surface-hover border-b border-border flex items-center gap-3 px-4 sm:px-6 text-text-primary h-(--size-control-2xl) shrink-0">

            {/* Hamburger / Toggle Sidebar */}
            {onToggleSidebar && (
                <button
                    type="button"
                    aria-label="Alternar menú de navegación"
                    onClick={handleMenuClick}
                    className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors cursor-pointer text-text-primary"
                >
                    <Menu size={22} />
                </button>
            )}

            {/* Marca institucional: logosímbolo oficial SENA + línea + nombre del sistema */}
            <img
                src={senaLogoVerde}
                alt="Logo SENA"
                className="h-9 w-auto object-contain shrink-0 dark:hidden"
            />
            <img
                src={senaLogoBlanco}
                alt=""
                aria-hidden="true"
                className="h-9 w-auto object-contain shrink-0 hidden dark:block"
            />
            <span aria-hidden="true" className="w-px self-stretch my-1 bg-border shrink-0" />

            {/* Título */}
            <div className="flex-1 min-w-0 leading-tight">
                <h1 className="text-h1 font-heading truncate uppercase tracking-wide">
                    SAGI
                </h1>
                <p className="hidden sm:block text-small text-text-muted truncate">
                    Sistema Administrativo de Gestión de Inventarios
                </p>
            </div>

            {/* Campana de notificaciones (loans para admin, tareas para usuarios). */}
            <NotificationsBell />

            {/* Selector de tema (claro / oscuro / sistema) */}
            <ThemeToggle />

            {/* Perfil: nombre + avatar (clic redirige a /configuracion).
                Convertido a <button onClick> en lugar de <Link> para poder
                interceptar la navegación cuando hay un formulario sucio. */}
            <button
                type="button"
                onClick={handleProfileClick}
                aria-label="Ir a mi perfil"
                title="Mi perfil"
                className="flex items-center gap-3 shrink-0 rounded-xl px-3 py-1.5 hover:bg-surface-muted transition-colors cursor-pointer bg-transparent border-0 text-text-primary"
            >
                <span className="hidden sm:inline text-text-primary">{userName}</span>
                {user?.profile_picture ? (
                    <img
                        src={mediaUrl(user.profile_picture)}
                        alt={userName}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                ) : (
                    <span className="w-10 h-10 rounded-full bg-brand text-on-brand flex items-center justify-center font-heading text-h3">
                        {userInitial}
                    </span>
                )}
            </button>

        </nav>
    );
}
