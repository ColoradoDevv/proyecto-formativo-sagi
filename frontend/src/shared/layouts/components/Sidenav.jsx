import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { House, Users, Wrench, Truck, Scroll, Settings, LogOut, X, ClipboardList } from "lucide-react";
import { logout } from "@/features/auth/services/authService";
import { cancelAlert } from "@/shared";
import { usePermissions } from "@/shared/hooks/usePermissions";

//
// Mapa de módulos del menú lateral.
// `requiredPerms`: basta con tener UNO de los codenames listados para ver el enlace.
// Si la lista está vacía, el enlace es visible para cualquier usuario autenticado.
//
const NAV_MODULES = [
    {
        to: "/",
        icon: <House size={20} />,
        label: "Inicio",
        requiredPerms: [], // visible siempre
    },
    {
        to: "/usuarios",
        icon: <Users size={20} />,
        label: "Usuarios",
        requiredPerms: ["view_user", "create_user", "edit_user", "delete_user", "list_users"],
    },
    {
        to: "/consumibles",
        icon: <Wrench size={20} />,
        label: "Consumibles",
        requiredPerms: [
            "view_consumable_material", "list_consumable_materials",
            "create_consumable_material", "update_consumable_material",
            "view_consumable", "create_consumable", "edit_consumable",
        ],
    },
    {
        to: "/devolutivos",
        icon: <Scroll size={20} />,
        label: "Devolutivos",
        requiredPerms: [
            "view_returnable_material", "list_returnable_materials",
            "create_returnable_material", "update_returnable_material",
            "view_returnable", "create_returnable", "edit_returnable",
        ],
    },
    {
        to: "/prestamos",
        icon: <Truck size={20} />,
        label: "Préstamos",
        requiredPerms: ["view_loan", "create_loan", "edit_loan", "list_loans"],
    },
];

function NavLinks({ onLinkClick, isCollapsed = false }) {
    const navigate = useNavigate();
    const { canAny, isSuper, isPrimaryAdmin } = usePermissions();

    // Filtramos los módulos según los permisos del usuario.
    const visibleModules = NAV_MODULES.filter(({ requiredPerms }) =>
        requiredPerms.length === 0 ? true : canAny(requiredPerms)
    );

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 h-10 min-h-10 box-border p-2.5 rounded-lg transition-colors ${
            isCollapsed ? "justify-start" : ""
        } ${
            isActive
                ? "bg-brand text-text-inverse font-medium"
                : "hover:bg-surface-muted text-text-primary"
        }`;

    const renderNavContent = (icon, label, isActive) => (
        <>
            <span className={`shrink-0 flex items-center justify-center transition-transform duration-300 ease-in-out ${isCollapsed ? "translate-x-1" : "translate-x-0"}`}>
                {icon}
            </span>
            {!isCollapsed && <span className="truncate whitespace-nowrap flex-1">{label}</span>}
            {!isCollapsed && isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-text-inverse shrink-0" />
            )}
        </>
    );

    async function handleLogout() {
        const result = await cancelAlert({
            title: "¿Cerrar sesión?",
            text: "Tendrás que volver a iniciar sesión para acceder al sistema.",
            confirmText: "Sí, cerrar sesión",
            cancelText: "Seguir aquí",
        });

        if (!result.isConfirmed) {
            onLinkClick?.();
            return;
        }

        logout();
        navigate("/iniciar-sesion");
    }

    return (
        <div className="flex flex-col h-full justify-between gap-6 overflow-y-auto">
            <ul className="flex flex-col gap-1">
                {visibleModules.map(({ to, icon, label }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            end={to === "/"}
                            onClick={onLinkClick}
                            className={linkClass}
                            title={label}
                        >
                            {({ isActive }) => renderNavContent(icon, label, isActive)}
                        </NavLink>
                    </li>
                ))}
            </ul>

            <ul className="flex flex-col gap-1 pt-4 border-t border-border/50">
                {/* Configuración */}
                {(isSuper || canAny(["manage_groups", "manage_role_permissions", "create_role", "list_roles"])) && (
                    <li>
                        <NavLink to="/configuracion" onClick={onLinkClick} className={linkClass} title="Configuración">
                            {({ isActive }) => renderNavContent(<Settings size={20} />, "Configuración", isActive)}
                        </NavLink>
                    </li>
                )}

                {/* Auditoría */}
                {isPrimaryAdmin && (
                    <li>
                        <NavLink to="/auditoria" onClick={onLinkClick} className={linkClass} title="Auditoría">
                            {({ isActive }) => renderNavContent(<ClipboardList size={20} />, "Auditoría", isActive)}
                        </NavLink>
                    </li>
                )}

                {/* Cerrar sesión */}
                <li>
                    <button
                        type="button"
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        className={`flex items-center gap-3 h-10 min-h-10 box-border p-2.5 rounded-lg hover:bg-surface-muted transition-colors w-full text-left cursor-pointer text-text-primary ${
                            isCollapsed ? "justify-start" : ""
                        }`}
                    >
                        <span className={`shrink-0 flex items-center justify-center transition-transform duration-300 ease-in-out ${isCollapsed ? "translate-x-1" : "translate-x-0"}`}>
                            <LogOut size={20} />
                        </span>
                        {!isCollapsed && <span className="truncate whitespace-nowrap">Cerrar sesión</span>}
                    </button>
                </li>
            </ul>
        </div>
    );
}

export default function Sidenav({ isOpen = false, onClose }) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem("sidebar_collapsed") === "true";
    });

    useEffect(() => {
        const handleToggle = () => {
            setIsCollapsed((prev) => {
                const next = !prev;
                localStorage.setItem("sidebar_collapsed", String(next));
                return next;
            });
        };
        window.addEventListener("toggle-sidebar-collapse", handleToggle);
        return () => window.removeEventListener("toggle-sidebar-collapse", handleToggle);
    }, []);

    return (
        <>
            {/* ── Móvil / tablet: drawer con overlay ── */}
            <div className={`fixed inset-0 z-40 lg:hidden ${isOpen ? "" : "pointer-events-none"}`}>

                {/* Backdrop */}
                <div
                    role="presentation"
                    className={`absolute inset-0 bg-background-inverse/40 transition-opacity duration-[var(--duration-slow)] ${isOpen ? "opacity-100" : "opacity-0"}`}
                    onClick={onClose}
                />

                {/* Panel deslizante */}
                <aside
                    className={`
                        absolute left-0 top-0 h-full w-64
                        bg-[var(--color-primary-50)] border-r border-border text-text-primary
                        p-5 flex flex-col justify-between
                        transition-transform duration-[var(--duration-slow)] ease-in-out
                        ${isOpen ? "translate-x-0" : "-translate-x-full"}
                    `}
                >
                    <div className="flex flex-col gap-4 h-full">
                        {/* Botón cerrar */}
                        <button
                            type="button"
                            aria-label="Cerrar menú"
                            onClick={onClose}
                            className="self-end p-1 rounded hover:bg-surface-muted transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex-1 overflow-hidden">
                            <NavLinks onLinkClick={onClose} isCollapsed={false} />
                        </div>
                    </div>
                </aside>

            </div>

            {/* ── Desktop: sidebar colapsable ── */}
            <aside
                className={`hidden lg:flex bg-[var(--color-primary-50)] border-r border-border text-text-primary p-4 flex-col justify-between shrink-0 transition-all duration-300 ease-in-out ${
                    isCollapsed ? "w-16 px-2" : "w-64"
                }`}
            >
                <div className="flex-1 overflow-hidden">
                    <NavLinks isCollapsed={isCollapsed} />
                </div>
            </aside>
        </>
    );
}
