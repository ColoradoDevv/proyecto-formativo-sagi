import { Outlet } from "react-router-dom";
import bgLogin from "@/assets/images/auth/bg-login.png";
import senaLogoVerde from "@/assets/images/sena/logo-sena-verde.svg";
import senaLogoBlanco from "@/assets/images/sena/logo-sena-blanco.svg";

// Estructura visual para las vistas de autenticacion (sin navegacion principal).
// Centraliza el fondo, la tarjeta glassmorphism, el logo SENA y la ilustracion;
// el formulario concreto (login, recuperar contraseña, etc.) llega como children.
export default function AuthLayout({ children }) {
    return (
        <div className="relative w-full h-screen overflow-hidden flex items-center justify-center">

            {/* Fondo */}
            <img
                src={bgLogin}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition dark:brightness-[0.38] dark:saturate-[0.8]"
            />

            {/* Tarjeta glassmorphism — contiene TODO.
                En oscuro el fondo se atenúa (ver img) y la tarjeta se vuelve
                más sólida para que el texto claro mantenga contraste AA. */}
            <div className="
                relative z-10
                w-min max-w-md md:max-w-5xl
                h-auto md:h-[85vh]
                rounded-[var(--radius-3xl)]
                flex flex-row
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

                {/* ── Lado derecho: formulario ── */}
                <div className="relative grid items-center justify-center p-6 pt-20 sm:pt-24 md:p-0 ">
                    <div className="w-full max-w-md px-8 py-10 sm:px-10">
                        <div className="text-center mb-8">
                            <h1 className="text-h1 font-heading font-bold text-text-primary select-none pb-4">
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
