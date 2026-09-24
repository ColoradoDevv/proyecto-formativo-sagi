// Imports

// Rutas
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

// Imports Auth (eager: primer pantallazo)
import { LoginPage, ProtectedRoute, ForgotPasswordPage, ResetPasswordPage, PrivacyNoticePage } from "@/features/auth"
import { RequirePerms } from "@/features/auth/components/ProtectedRoute"
import { MODULE_PERMS } from "@/shared/hooks/usePermissions"

// Páginas diferidas por módulo: cada una viaja en su propio chunk y solo
// se descarga al navegar a ella (antes todo iba en un único JS de 1.7MB).
const DashboardPage  = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const UserHomePage   = lazy(() => import("@/features/users/pages/UserHomePage"));
const UserCreatePage = lazy(() => import("@/features/users/pages/create/UserCreatePage"));
const UserDetailPage = lazy(() => import("@/features/users/pages/detail/UserDetailPage"));
const UserEditPage   = lazy(() => import("@/features/users/pages/edit/UserEditPage"));
const CmHomePage     = lazy(() => import("@/features/consumable-material/pages/CmHomePage"));
const CmCreatePage   = lazy(() => import("@/features/consumable-material/pages/create/CmCreatePage"));
const CmDetailPage   = lazy(() => import("@/features/consumable-material/pages/detail/CmDetailPage"));
const CmEditPage     = lazy(() => import("@/features/consumable-material/pages/edit/CmEditPage"));
const RmHomePage     = lazy(() => import("@/features/returnable-material/pages/RmHomePage"));
const RmCreatePage   = lazy(() => import("@/features/returnable-material/pages/create/RmCreatePage"));
const RmDetailPage   = lazy(() => import("@/features/returnable-material/pages/detail/RmDetailPage"));
const RmEditPage     = lazy(() => import("@/features/returnable-material/pages/edit/RmEditPage"));
const LoansHomePage  = lazy(() => import("@/features/loans/pages/LoansHomePage"));
const LoansCreatePage = lazy(() => import("@/features/loans/pages/create/LoansCreatePage"));
const LoansEditPage  = lazy(() => import("@/features/loans/pages/edit/LoansEditPage"));
const LoansDetailPage = lazy(() => import("@/features/loans/pages/detail/LoansDetailPage"));
const LoanSignPage   = lazy(() => import("@/features/loans/pages/sign/LoanSignPage"));
const BatchReturnPage = lazy(() => import("@/features/loans/pages/batch-return/BatchReturnPage"));
const TaskHomePage   = lazy(() => import("@/features/tasks/pages/TaskHomePage"));
const InventoryHomePage = lazy(() => import("@/features/inventories/pages/InventoryHomePage"));
const QuotationsPage = lazy(() => import("@/features/quotations/pages/QuotationsPage"));
const AuditLogPage   = lazy(() => import("@/features/audit/pages/AuditLogPage"));

import { ConfigLayout, MainLayout } from "@/shared";

// Carga diferida sin dependencias (no agranda el chunk inicial).
function RouteFallback() {
    return (
        <div className="h-full min-h-[40vh] flex items-center justify-center" aria-label="Cargando">
            <span className="size-10 rounded-full border-2 border-border-strong border-t-brand animate-spin" />
        </div>
    );
}


export default function AppRouter() {
    return (
        <>
            <PageTitle />
            <Suspense fallback={<RouteFallback />}>
            <Routes>
            {/* ───────── Rutas PUBLICAS ───────── */}
            <Route path="/iniciar-sesion" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/aviso-privacidad" element={<PrivacyNoticePage />} />

            {/* Firma externa — receptor NO registrado, sin sesión.
                El backend envía este enlace por correo con token + OTP. */}
            <Route path="/prestamos/firmar-externo" element={<LoanSignPage />} />

            {/* ───────── Rutas PRIVADAS (requieren sesion) ───────── */}
            <Route element={<ProtectedRoute />}>

                {/* Inicio - Home */}
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                </Route>

                {/* CRUD de Usuario */}
                <Route path="/usuarios" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.users.view}><UserHomePage /></RequirePerms>} />
                    <Route path="crear" element={<RequirePerms perms={MODULE_PERMS.users.create}><UserCreatePage /></RequirePerms>} />
                    <Route path="visualizar/:id" element={<RequirePerms perms={MODULE_PERMS.users.view}><UserDetailPage /></RequirePerms>} />
                    <Route path="editar/:id" element={<RequirePerms perms={MODULE_PERMS.users.edit}><UserEditPage /></RequirePerms>} />
                </Route>

                {/* CRUD de Materiales Consumibles */}
                <Route path="/consumibles" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.consumables.view}><CmHomePage /></RequirePerms>} />
                    <Route path="crear" element={<RequirePerms perms={MODULE_PERMS.consumables.create}><CmCreatePage /></RequirePerms>} />
                    <Route path="visualizar/:id" element={<RequirePerms perms={MODULE_PERMS.consumables.view}><CmDetailPage /></RequirePerms>} />
                    <Route path="editar/:id" element={<RequirePerms perms={MODULE_PERMS.consumables.edit}><CmEditPage /></RequirePerms>} />
                </Route>

                {/* CRUD de Materiales Devolutivos */}
                <Route path="/devolutivos" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.returnables.view}><RmHomePage /></RequirePerms>} />
                    <Route path="crear" element={<RequirePerms perms={MODULE_PERMS.returnables.create}><RmCreatePage /></RequirePerms>} />
                    <Route path="visualizar/:id" element={<RequirePerms perms={MODULE_PERMS.returnables.view}><RmDetailPage /></RequirePerms>} />
                    <Route path="editar/:id" element={<RequirePerms perms={MODULE_PERMS.returnables.edit}><RmEditPage /></RequirePerms>} />
                </Route>

                {/* CRUD de Prestamos */}
                <Route path="/prestamos" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.loans.view}><LoansHomePage /></RequirePerms>} />
                    <Route path="crear" element={<RequirePerms perms={MODULE_PERMS.loans.create}><LoansCreatePage /></RequirePerms>} />
                    <Route path="visualizar/:id" element={<RequirePerms perms={MODULE_PERMS.loans.view}><LoansDetailPage /></RequirePerms>} />
                    <Route path="editar/:id" element={<RequirePerms perms={MODULE_PERMS.loans.edit}><LoansEditPage /></RequirePerms>} />
                    <Route path="lote/:batchId" element={<RequirePerms perms={MODULE_PERMS.loans.view}><LoansDetailPage /></RequirePerms>} />
                    <Route path="lote/:batchId/devolver" element={<RequirePerms perms={[...MODULE_PERMS.loans.view, ...MODULE_PERMS.loans.createReturn]} requireAll><BatchReturnPage /></RequirePerms>} />
                </Route>

                {/* Firma electrónica de préstamo — requiere sesión */}
                <Route path="/prestamos/firmar" element={<LoanSignPage />} />

                {/* CRUD de Cotizaciones (biblioteca de PDFs) */}
                <Route path="/cotizaciones" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.quotations.view}><QuotationsPage /></RequirePerms>} />
                </Route>

                {/* Tareas (asignaciones y definiciones) */}
                <Route path="/tareas" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.tasks.view}><TaskHomePage /></RequirePerms>} />
                </Route>

                {/* Inventarios (catálogo de nombres de inventario) */}
                <Route path="/inventarios" element={<MainLayout />}>
                    <Route index element={<RequirePerms perms={MODULE_PERMS.inventories.view}><InventoryHomePage /></RequirePerms>} />
                </Route>

                {/* Marcas: se gestionan desde la pestaña de configuración (modales) */}
                <Route path="/marcas" element={<MainLayout />}>
                    <Route index element={<Navigate to="/configuracion" replace />} />
                </Route>


                {/* Configuracion */}
                <Route path="/configuracion" element={<ConfigLayout />} />

                {/* Historial de Auditoría — solo superadministrador primigenio */}
                <Route path="/auditoria" element={<MainLayout />}>
                    <Route index element={<AuditLogPage />} />
                </Route>

            </Route>
            </Routes>
            </Suspense>
        </>
    );
}

// Título del documento por ruta (WCAG 2.4.2: cada vista identifica su
// propósito). Vive aquí para no tocar las ~20 páginas una por una.
function PageTitle() {
    const { pathname } = useLocation();

    useEffect(() => {
        const routes = [
            ["/iniciar-sesion", "Iniciar sesión"],
            ["/forgot-password", "Recuperar contraseña"],
            ["/reset-password", "Restablecer contraseña"],
            ["/aviso-privacidad", "Aviso de privacidad"],
            ["/prestamos/firmar-externo", "Firma de préstamo"],
            ["/prestamos/firmar", "Firma de préstamo"],
            ["/prestamos/crear", "Crear préstamo"],
            ["/prestamos/lote", "Detalle de préstamo"],
            ["/prestamos", "Préstamos"],
            ["/usuarios/crear", "Crear usuario"],
            ["/usuarios", "Usuarios"],
            ["/consumibles", "Material consumible"],
            ["/devolutivos", "Material devolutivo"],
            ["/cotizaciones", "Cotizaciones"],
            ["/tareas", "Tareas"],
            ["/inventarios", "Inventarios"],
            ["/configuracion", "Configuración"],
            ["/auditoria", "Auditoría"],
            ["/marcas", "Marcas"],
        ];
        const match = routes.find(([prefix]) =>
            prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
        );
        document.title = match ? `SAGI · ${match[1]} — SENA` : "SAGI — SENA";
    }, [pathname]);

    return null;
}
