import { Outlet } from "react-router-dom";
import bgLogin from "@/assets/images/auth/bg-login.png";
import senaLogoVerde from "@/assets/images/sena/logo-sena-verde.svg";
import senaLogoBlanco from "@/assets/images/sena/logo-sena-blanco.svg";

// Estructura visual para las vistas de autenticacion (sin navegacion principal).
// Centraliza el fondo, la tarjeta glassmorphism, el logo SENA y la ilustracion;
// el formulario concreto (login, recuperar contraseña, etc.) llega como children.
export default function AuthLayout({ children }) {
    return (
        <div className="relative w-full h-svh overflow-hidden flex items-center justify-center p-4">

            {/* Fondo */}
            <img
                src={bgLogin}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition dark:brightness-[0.38] dark:saturate-[0.8]"
            />

            {/* Tarjeta glassmorphism — contiene TODO. Altura flexible: se
                estira junto con el contenido (ej. mensajes de error largos)
                sin recortarlo; con mínimo para presencia y tope al viewport.
                En oscuro el fondo se atenúa (ver img) y la tarjeta se vuelve
                más sólida para mantener contraste AA. */}
            <div className="
                relative z-10
                w-[min(28rem,100%)] h-auto min-h-[min(560px,100%)] max-h-full
                rounded-[var(--radius-3xl)]
                flex flex-col
                backdrop-blur-md
                bg-surface-hover/55 dark:bg-surface-hover/85
                border border-surface-hover/40 dark:border-border
                shadow-[var(--shadow-elevation-5)]
                overflow-hidden
            ">
                    {/* Logo SENA oficial (vector): verde en claro, blanco en oscuro */}
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 pointer-events-none ">
                        <img
                            src={senaLogoVerde}
                            alt="Logo SENA"
                            className="h-12 sm:h-16 w-auto object-contain dark:hidden"
                        />
                        <img
                            src={senaLogoBlanco}
                            alt=""
                            aria-hidden="true"
                            className="h-12 sm:h-16 w-auto object-contain hidden dark:block"
                        />
                    </div>

                {/* ── Lado derecho: formulario fijo y centrado (sin scroll) ── */}
                <div className="relative w-full flex-1 min-h-0 grid items-center justify-center px-4 py-3 sm:p-6 overflow-hidden">
                    <div className="w-full max-w-md min-w-0 m-auto px-4 py-4 sm:px-8 sm:py-10">
                        <div className="text-center mb-4 sm:mb-8">
                            <h1 className="text-h1 font-heading font-bold text-text-primary select-none pb-2 sm:pb-4">
                                SAGI
                            </h1>
                            <p className="-mt-6 text-medium text-text-secondary select-none">
                                Sistema Administrativo de Gestión de Inventarios — SENA
                            </p>
                        </div>
                        {children ?? <Outlet />}
                    </div>
                </div>
            </div>
        </div>
    );
}
