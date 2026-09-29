export default function StatusBadge({ active, activeLabel = "Activo", inactiveLabel = "Inactivo", className = "" }) {
    return (
        <span className={`px-3 py-0.5 rounded-[var(--radius-full)] text-small font-medium ${active ? "bg-success-soft text-success" : "bg-error-soft text-error"} ${className}`}>
            {active ? activeLabel : inactiveLabel}
        </span>
    );
}
