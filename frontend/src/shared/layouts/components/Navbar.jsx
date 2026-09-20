import { Archive, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { usePermissions } from "@/shared/hooks/usePermissions";
import ThemeToggle from "@/shared/components/ThemeToggle";


export default function Navbar({ onToggleSidebar }) {

    // usePermissions() expone el usuario de forma reactiva (se refresca solo
    // con sia:session-updated) — a diferencia de leer getStoredUser()
    // directamente, así el avatar se actualiza sin recargar la página al
    // cambiar la foto de perfil desde "Mi perfil".
    const { user } = usePermissions();
    const userName = user?.first_name ?? "Usuario";
    const userInitial = (user?.first_name?.[0] ?? "U").toUpperCase();

    const handleMenuClick = () => {
        if (onToggleSidebar) onToggleSidebar();
        window.dispatchEvent(new Event("toggle-sidebar-collapse"));
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

            {/* Icono de inventario dentro de círculo */}
            <div className="bg-brand text-text-inverse rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                <Archive size={18} strokeWidth={2.25} />
            </div>

            {/* Título */}
            <h1 className="text-h3 font-heading flex-1 truncate uppercase tracking-wide">
                SGI / Inventario
            </h1>

            {/* Selector de tema (claro / oscuro / sistema) */}
            <ThemeToggle />

            {/* Perfil: nombre + avatar (clic redirige a /configuracion) */}
            <Link
                to="/configuracion"
                aria-label="Ir a mi perfil"
                title="Mi perfil"
                className="flex items-center gap-3 shrink-0 rounded-xl px-3 py-1.5 hover:bg-surface-muted transition-colors cursor-pointer"
            >
                <span className="hidden sm:inline text-text-primary">{userName}</span>
                {user?.profile_picture ? (
                    <img
                        src={user.profile_picture}
                        alt={userName}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                ) : (
                    <span className="w-10 h-10 rounded-full bg-brand text-text-inverse flex items-center justify-center font-heading text-h3">
                        {userInitial}
                    </span>
                )}
            </Link>

        </nav>
    );
}
