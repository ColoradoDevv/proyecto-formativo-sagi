import { useCallback, useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { House, Users, Wrench, Truck, Scroll, Settings, LogOut, X, ClipboardList, FileText, ListChecks, Boxes } from "lucide-react";
import { logout } from "@/features/auth/services/authService";
import { cancelAlert } from "@/shared";
import { usePermissions, MODULE_PERMS } from "@/shared/hooks/usePermissions";
import { useDirtyFormStatus } from "@/shared";

//
// Mapa de módulos del menú lateral.
// Cada enlace se muestra SOLO si el usuario tiene el permiso de VER
// (listar) que el backend exige para ese módulo — tener solo create/edit
// no muestra el módulo (antes bastaba cualquiera y el listado devolvía
// "Permiso requerido").
// Si la lista está vacía, el enlace es visible para cualquier autenticado.
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
        requiredPerms: MODULE_PERMS.users.view,
    },
    {
        to: "/consumibles",
        icon: <Wrench size={20} />,
        label: "Consumibles",
        requiredPerms: MODULE_PERMS.consumables.view,
    },
    {
        to: "/devolutivos",
        icon: <Scroll size={20} />,
        label: "Devolutivos",
        requiredPerms: MODULE_PERMS.returnables.view,
    },
    {
        to: "/prestamos",
        icon: <Truck size={20} />,
        label: "Préstamos",
        requiredPerms: MODULE_PERMS.loans.view,
    },
    {
        to: "/cotizaciones",
        icon: <FileText size={20} />,
        label: "Cotizaciones",
        requiredPerms: MODULE_PERMS.quotations.view,
    },
    {
        to: "/tareas",
        icon: <ListChecks size={20} />,
        label: "Tareas",
        requiredPerms: MODULE_PERMS.tasks.view,
    },
    {
        to: "/inventarios",
        icon: <Boxes size={20} />,
        label: "Inventarios",
        requiredPerms: MODULE_PERMS.inventories.view,
    },
];

function NavLinks({ onLinkClick, isCollapsed = false }) {
    const navigate = useNavigate();
    const { canAny, isPrimaryAdmin } = usePermissions();
    const { isDirty } = useDirtyFormStatus();

    // Filtramos los módulos según los permisos del usuario.
    const visibleModules = NAV_MODULES.filter(({ requiredPerms }) =>
        requiredPerms.length === 0 ? true : canAny(requiredPerms)
    );

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 h-10 min-h-10 box-border p-2.5 rounded-lg transition-colors ${
            isCollapsed ? "justify-start" : ""
        } ${
            isActive
                ? "bg-brand text-on-brand font-medium"
                : "hover:bg-surface-muted text-text-primary"
        }`;

    const renderNavContent = (icon, label, isActive) => (
        <>
            <span className={`shrink-0 flex items-center justify-center transition-transform duration-300 ease-in-out ${isCollapsed ? "translate-x-1" : "translate-x-0"}`}>
                {icon}
            </span>
            {!isCollapsed && <span className="truncate whitespace-nowrap flex-1">{label}</span>}
            {!isCollapsed && isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-on-brand shrink-0" />
            )}
        </>
    );

    // Intercepta el click en cualquier enlace del SideNav. Si hay un
    // formulario sucio montado, bloquea la navegación por defecto y muestra
    // el modal `cancelAlert`; solo al confirmar se navega al destino.
    const handleGuardedNav = useCallback(
        (e, to) => {
            if (!isDirty()) return; // deja que NavLink navegue normalmente
            e.preventDefault();
            e.stopPropagation();
            (async () => {
                const result = await cancelAlert();
                if (result.isConfirmed) {
                    navigate(to);
                    onLinkClick?.();
                }
            })();
        },
        [isDirty, navigate, onLinkClick]
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
                            onClick={(e) => handleGuardedNav(e, to)}
                            className={linkClass}
                            title={label}
                        >
                            {({ isActive }) => renderNavContent(icon, label, isActive)}
                        </NavLink>
                    </li>
                ))}
            </ul>

            <ul className="flex flex-col gap-1 pt-4 border-t border-border/50">
                {/* Configuración: visible para todos. Las pestañas internas
                    (Mi perfil por defecto, Marcas, Categorías, Roles, Grupos)
                    se muestran según el permiso de cada una. */}
                <li>
                    <NavLink
                        to="/configuracion"
                        onClick={(e) => handleGuardedNav(e, "/configuracion")}
                        className={linkClass}
                        title="Configuración"
                    >
                        {({ isActive }) => renderNavContent(<Settings size={20} />, "Configuración", isActive)}
                    </NavLink>
                </li>

                {/* Auditoría */}
                {isPrimaryAdmin && (
                    <li>
                        <NavLink
                            to="/auditoria"
                            onClick={(e) => handleGuardedNav(e, "/auditoria")}
                            className={linkClass}
                            title="Auditoría"
                        >
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
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden overflow-hidden animate-fade-in"
                >

                    {/* Backdrop */}
                    <div
                        role="presentation"
                        className="absolute inset-0 bg-background-inverse/40 animate-fade-in"
                        onClick={onClose}
                    />

                    {/* Panel deslizante */}
                    <aside
                        className="absolute left-0 top-0 h-full w-64 bg-surface-hover border-r border-border text-text-primary p-5 flex flex-col justify-between animate-slide-in-left"
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
            )}

            {/* ── Desktop: sidebar colapsable ── */}
            <aside
                className={`hidden lg:flex bg-surface-hover border-r border-border text-text-primary p-4 flex-col justify-between shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
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
