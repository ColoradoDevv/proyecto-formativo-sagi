import { Component } from "react";
import { Button } from "./Button";

//
// Red de seguridad de render: si cualquier página rompe al pintar,
// muestra una tarjeta de error en vez de una pantalla blanca total.
// Úsalo envolviendo la app en main.jsx.
//
export default class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        // Sin Sentry: queda en consola para diagnóstico local.
        console.error("Error no controlado en render:", error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-text-primary">
                <div className="bg-surface-hover border border-border rounded-[var(--radius-2xl)] px-8 py-10 w-full max-w-md flex flex-col items-center gap-4 text-center animate-slide-up">
                    <h2 className="text-h2 font-heading">Algo salió mal</h2>
                    <p className="text-small text-text-muted">
                        La aplicación encontró un error inesperado. Recarga la página; si persiste, contacta al administrador.
                    </p>
                    <Button type="button" variant="primary" size="md" onClick={() => window.location.reload()}>
                        Recargar aplicación
                    </Button>
                </div>
            </div>
        );
    }
}
