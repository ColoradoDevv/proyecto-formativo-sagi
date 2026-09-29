// Pildora de color segun el estado del prestamo.
// Usa clases-token para adaptarse a tema claro/oscuro.
const STATE_STYLES = {
    "Pendiente": "bg-warning-soft text-warning",
    "Activo":    "bg-brand-soft text-brand",
    "Finalizado":"bg-success-soft text-success",
    "Incompleto":"bg-error-soft text-error",
};

export default function LoanStateBadge({ state }) {
    const label = state ?? "Pendiente";
    const style = STATE_STYLES[label] ?? "bg-surface-muted/70 text-text-secondary";
    return (
        <span className={`inline-block text-small font-medium px-3 py-0.5 rounded-[var(--radius-full)] ${style}`}>
            {label}
        </span>
    );
}
