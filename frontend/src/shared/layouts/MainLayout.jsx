import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidenav from "./components/Sidenav";
import { useInactivityLogout } from "@/shared/hooks/useInactivityLogout";
import { getStoredUser, isAuthenticated } from "@/shared/services/api";
import { clsx } from 'clsx';

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
    
    const [isDark, setDark] = useState(false);

    const toggleTheme = () => {
        setDark(!isDark)
    }
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const mustChangePassword = useMustChangePassword();
    useInactivityLogout();

    // Mientras el cambio de contraseña es obligatorio, no montamos la UI
    // del sistema para evitar interacciones y peticiones API innecesarias.
    if (mustChangePassword) {
        return <div className="h-screen bg-background/70" aria-hidden="true" />;
    }

    return (
        <div className={clsx ("h-screen flex flex-col", isDark ? "dark" : "")}>
            <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)}/>
            <div className="flex flex-1 overflow-hidden">
                <Sidenav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 bg-background/70 text-text-primary overflow-y-auto">
                    {children ?? <Outlet />}
                </main>
            </div>
        </div>
    );
}
