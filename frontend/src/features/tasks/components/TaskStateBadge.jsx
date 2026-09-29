// Pildora de color segun el estado de la tarea.
// Usa clases-token para adaptarse a tema claro/oscuro.
const STATE_STYLES = {
    "Pendiente": "bg-surface-muted text-text-secondary",
    "En progreso": "bg-brand-soft text-brand",
    "En revisión": "bg-warning-soft text-warning",
    "Completada": "bg-success-soft text-success",
    "Cancelada": "bg-error-soft text-error",
};

export default function TaskStateBadge({ state }) {
    const style = STATE_STYLES[state] ?? "bg-surface-muted text-text-secondary";
    return (
        <span className={`inline-block text-small font-medium px-2 py-0.5 rounded-[var(--radius-full)] ${style}`}>
            {state}
        </span>
    );
}
