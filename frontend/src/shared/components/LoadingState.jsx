import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";

// Estado de carga uniforme para listados: spinner + etiqueta honesta
// de QUÉ se está cargando (un spinner solo no orienta en esperas largas).
export default function LoadingState({ label = "Cargando…" }) {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
            <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            <p className="text-small text-text-muted animate-pulse">{label}</p>
        </div>
    );
}
