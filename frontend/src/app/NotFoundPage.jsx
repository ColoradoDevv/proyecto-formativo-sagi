import { useNavigate } from "react-router-dom";
import { Button } from "@/shared";

//
// Página 404: rutas desconocidas dentro de la zona privada.
// Se monta con MainLayout para conservar el chrome de la app.
//

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="h-full flex items-center justify-center p-6">
            <div className="bg-surface-hover border border-border rounded-[var(--radius-2xl)] px-8 py-10 w-full max-w-md flex flex-col items-center gap-4 text-center animate-slide-up">
                <span className="text-h2 font-heading text-text-muted">404</span>
                <h2 className="text-h2 font-heading text-text-primary">Página no encontrada</h2>
                <p className="text-small text-text-muted">
                    La dirección que buscas no existe o fue movida.
                </p>
                <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" size="md" onClick={() => navigate(-1)}>
                        Volver atrás
                    </Button>
                    <Button type="button" variant="primary" size="md" onClick={() => navigate("/", { replace: true })}>
                        Ir al inicio
                    </Button>
                </div>
            </div>
        </div>
    );
}
