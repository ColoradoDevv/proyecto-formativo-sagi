import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidenav from "./components/Sidenav";
import { useInactivityLogout } from "@/shared/hooks/useInactivityLogout";
import { getStoredUser, isAuthenticated } from "@/shared/services/api";

function useMustChangePassword() {
    const [mustChange, setMustChange] = useState(false);

    useEffect(() => {
        const sync = () => {
            const user = getStoredUser();
            setMustChange(Boolean(isAuthenticated() && user?.must_change_password));
        };
        sync();
        window.addEventListener("sia:session-updated", sync);
        return () => window.removeEventListener("sia:session-updated", sync);
    }, []);

    return mustChange;
}

export default function MainLayout({ children }) {

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const mustChangePassword = useMustChangePassword();
    useInactivityLogout();

    // Mientras el cambio de contraseña es obligatorio, no montamos la UI
    // del sistema para evitar interacciones y peticiones API innecesarias.
    if (mustChangePassword) {
        return <div className="h-screen bg-background" aria-hidden="true" />;
    }

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden max-w-full">
            <a
                href="#contenido-principal"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:rounded-[var(--radius-md)] focus:bg-text-primary focus:text-background focus:px-4 focus:py-2 focus:text-small"
            >
                Saltar al contenido principal
            </a>
            <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)}/>
            <div className="flex flex-1 overflow-hidden min-w-0">
                <Sidenav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main id="contenido-principal" tabIndex={-1} className="flex-1 min-w-0 bg-background/70 text-text-primary overflow-y-auto overflow-x-clip p-4 sm:p-6">
                    {children ?? <Outlet />}
                </main>
            </div>
        </div>
    );
}
