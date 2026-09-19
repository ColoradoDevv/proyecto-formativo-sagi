import { ChevronDown, Menu } from "lucide-react";
import {
    Dropdown,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
    DropdownTrigger,
    IconButton,
    cancelAlert,
} from "@/shared";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser } from "@/shared/services/api";
import { logout } from "@/features/auth/services/authService";
import { useState } from "react";
import clsx from "clsx";
import ThemeToggle from "@/shared/components/ThemeToggle";


export default function Navbar({ onToggleSidebar }) {

    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const userPlaceholder = getStoredUser()?.first_name;

    async function handleLogout() {
        const result = await cancelAlert({
            title: "¿Cerrar sesión?",
            text: "Tendrás que volver a iniciar sesión para acceder al sistema.",
            confirmText: "Sí, cerrar sesión",
            cancelText: "Seguir aquí",
        });

        if (!result.isConfirmed) return;

        logout();
        navigate("/iniciar-sesion");
    }

    const handleMenuClick = () => {
        if (onToggleSidebar) onToggleSidebar();
        window.dispatchEvent(new Event("toggle-sidebar-collapse"));
    };

    return (
        <div className={clsx("bg-surface-hover px-4 sm:px-6 border-b border-border flex items-center text-text-primary h-(--size-control-2xl) shrink-0")}>

            {/* Hamburger / Toggle Sidebar */}
            {onToggleSidebar && (
                <IconButton
                    type="button"
                    aria-label="Alternar menú de navegación"
                    onClick={handleMenuClick}
                    className="mr-3 p-1.5 rounded-lg hover:bg-surface-muted transition-colors cursor-pointer text-text-primary"
                >
                    <Menu size={22} />
                </IconButton>
            )}

            {/* Título — completo desde sm, abreviado en móvil */}
            <h1 className="text-h2 font-heading flex-1 truncate">
                SGI - Inventario<span className="hidden sm:inline"> Teleínformatica</span>
            </h1>

            {/* Selector de tema (claro / oscuro / sistema) */}
            <ThemeToggle />

            {/* Menú de usuario */}
            <Dropdown open={open} onOpenChange={setOpen}>
                <DropdownTrigger
                    aria-label="Menú de usuario"
                    className="ml-3 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-muted transition-colors text-text-primary"
                >
                    <span className="hidden lg:inline underline cursor-pointer">{userPlaceholder}</span>
                    <ChevronDown className="size-5 cursor-pointer" />
                </DropdownTrigger>
                <DropdownContent className="right-0 w-48">
                    <DropdownItem>
                        <Link to="/configuracion" className="block w-full">Ver Perfil</Link>
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem>
                        <button type="button" onClick={handleLogout} className="block w-full text-left">Cerrar Sesión</button>
                    </DropdownItem>
                </DropdownContent>
            </Dropdown>

        </div>
    );
}
