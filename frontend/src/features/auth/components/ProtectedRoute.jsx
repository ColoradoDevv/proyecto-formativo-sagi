import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    isAuthenticated,
    getToken,
    getStoredPermissions,
    setStoredPermissions,
} from "@/shared/services/api";
import { usePermissions } from "@/shared/hooks/usePermissions";
import { Button } from "@/shared";

//
// Guard de rutas privadas.
// Si no hay sesión redirige a /iniciar-sesion preservando la URL actual
// en ?next= para que LoginForm pueda volver allí tras el login exitoso.
// Además re-hidrata los permisos desde el backend si sessionStorage no
// los tiene (pestaña recargada con token válido pero sin sia_permissions).
//

export default function ProtectedRoute() {
    const location = useLocation();
    // Listo de entrada si no hay sesión o si ya hay permisos en sesión;
    // el fetch solo ocurre con token válido pero sin permisos guardados
    // (pestaña recargada). Sin setState síncrono en el efecto.
    const [ready, setReady] = useState(() => {
        const stored = getStoredPermissions();
        return !isAuthenticated() || (stored && stored.length > 0);
    });

    useEffect(() => {
        if (ready) return;

        const token = getToken();
        let cancelled = false;
        fetch("/api/permissions/permissions/my_permission_codes/", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => (res.ok ? res.json() : { permissions: [] }))
            .then((data) => {
                if (!cancelled) setStoredPermissions(data.permissions ?? []);
            })
            .catch(() => {
                if (!cancelled) setStoredPermissions([]);
            })
            .finally(() => {
                if (!cancelled) setReady(true);
            });
        return () => { cancelled = true; };
    }, [ready]);

    if (!ready) return null;

    if (!isAuthenticated()) {
        // Preservar la URL completa (pathname + search) como ?next=
        // para que LoginForm redirija de vuelta después del login.
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/iniciar-sesion?next=${next}`} replace />;
    }

    return <Outlet />;
}

//
// Guardia por permiso para rutas privadas.
// Si el usuario no tiene NINGUNO de los codenames exigidos, muestra
// "Sin permisos" en vez del contenido — así no se puede bypassear el
// sidebar/dashboard navegando directo a la URL (ej. /usuarios/crear).
// `requireAll`: exige TODOS los codenames en vez de cualquiera.
//
export function RequirePerms({ perms = [], requireAll = false, children }) {
    const { can, canAny, isSuper } = usePermissions();
    const navigate = useNavigate();

    const allowed = requireAll
        ? perms.every((c) => isSuper || can(c))
        : perms.length === 0 || canAny(perms);

    if (allowed) return <>{children}</>;

    return (
        <div className="h-full flex items-center justify-center p-6">
            <div className="bg-surface-hover border border-border rounded-[var(--radius-2xl)] px-8 py-10 w-full max-w-md flex flex-col items-center gap-4 text-center animate-slide-up">
                <h2 className="text-h2 font-heading text-text-primary">Sin permisos</h2>
                <p className="text-small text-text-muted">
                    No tienes permiso para acceder a esta sección. Si crees que es un error, contacta al administrador.
                </p>
                <Button type="button" variant="secondary" size="md" onClick={() => navigate(-1)}>
                    Volver atrás
                </Button>
            </div>
        </div>
    );
}
