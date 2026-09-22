// Imports

// Rutas
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

// Imports Auth
import { LoginPage, ProtectedRoute, ForgotPasswordPage, ResetPasswordPage, PrivacyNoticePage } from "@/features/auth"

// Imports Inicio
import { DashboardPage } from "@/features/dashboard";

// Imports Usuarios 
import { UserHomePage, UserCreatePage, UserDetailPage, UserEditPage } from "@/features/users";

// Imports Material de Consumo
import { CmHomePage, CmCreatePage, CmDetailPage, CmEditPage } from "@/features/consumable-material";

// Imports Material Devolutivo
import { RmHomePage, RmCreatePage, RmDetailPage, RmEditPage } from "@/features/returnable-material";

// Imports de Prestamos
import { LoansHomePage, LoansCreatePage, LoansEditPage, LoansDetailPage, LoanSignPage, BatchReturnPage } from "@/features/loans";

// Imports de Tareas
import { TaskHomePage } from "@/features/tasks";

// Imports de Inventarios (catálogo de nombres de inventario)
import { InventoryHomePage } from "@/features/inventories";

// Imports de Cotizaciones
import { QuotationsPage } from "@/features/quotations";

// Imports de Auditoría
import { AuditLogPage } from "@/features/audit";

import { ConfigLayout, MainLayout } from "@/shared";


export default function AppRouter() {
    return (
        <>
            <PageTitle />
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
                    <Route index element={<UserHomePage />} />
                    <Route path="crear" element={<UserCreatePage />} />
                    <Route path="visualizar/:id" element={<UserDetailPage />} />
                    <Route path="editar/:id" element={<UserEditPage />} />
                </Route>

                {/* CRUD de Materiales Consumibles */}
                <Route path="/consumibles" element={<MainLayout />}>
                    <Route index element={<CmHomePage />} />
                    <Route path="crear" element={<CmCreatePage />} />
                    <Route path="visualizar/:id" element={<CmDetailPage />} />
                    <Route path="editar/:id" element={<CmEditPage />} />
                </Route>

                {/* CRUD de Materiales Devolutivos */}
                <Route path="/devolutivos" element={<MainLayout />}>
                    <Route index element={<RmHomePage />} />
                    <Route path="crear" element={<RmCreatePage />} />
                    <Route path="visualizar/:id" element={<RmDetailPage />} />
                    <Route path="editar/:id" element={<RmEditPage />} />
                </Route>

                {/* CRUD de Prestamos */}
                <Route path="/prestamos" element={<MainLayout />}>
                    <Route index element={<LoansHomePage />} />
                    <Route path="crear" element={<LoansCreatePage />} />
                    <Route path="visualizar/:id" element={<LoansDetailPage />} />
                    <Route path="editar/:id" element={<LoansEditPage />} />
                    <Route path="lote/:batchId" element={<LoansDetailPage />} />
                    <Route path="lote/:batchId/devolver" element={<BatchReturnPage />} />
                </Route>

                {/* Firma electrónica de préstamo — requiere sesión */}
                <Route path="/prestamos/firmar" element={<LoanSignPage />} />

                {/* CRUD de Cotizaciones (biblioteca de PDFs) */}
                <Route path="/cotizaciones" element={<MainLayout />}>
                    <Route index element={<QuotationsPage />} />
                </Route>

                {/* Tareas (asignaciones y definiciones) */}
                <Route path="/tareas" element={<MainLayout />}>
                    <Route index element={<TaskHomePage />} />
                </Route>

                {/* Inventarios (catálogo de nombres de inventario) */}
                <Route path="/inventarios" element={<MainLayout />}>
                    <Route index element={<InventoryHomePage />} />
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
