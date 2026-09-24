import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

// Aviso en línea liviano (reemplaza a @mui/material/Alert, que arrastraba
// ~300KB al bundle por solo 4 usos). Colores del sistema en ambos temas.
const STYLES = {
    success: { wrap: "border-success/40 bg-success-soft text-text-primary", icon: "text-success", Icon: CheckCircle2 },
    error:   { wrap: "border-error/40 bg-error-soft text-text-primary",       icon: "text-error",   Icon: XCircle },
    warning: { wrap: "border-warning/40 bg-warning-soft text-text-primary",   icon: "text-warning", Icon: AlertTriangle },
    info:    { wrap: "border-border-strong bg-surface-muted text-text-primary", icon: "text-text-secondary", Icon: Info },
};

export default function Notice({ severity = "info", onClose, children, className = "" }) {
    const { wrap, icon, Icon } = STYLES[severity] ?? STYLES.info;
    return (
        <div
            role={severity === "error" ? "alert" : "status"}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-small animate-fade-in ${wrap} ${className}`}
        >
            <Icon size={18} className={`shrink-0 ${icon}`} />
            <div className="flex-1 min-w-0">{children}</div>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar aviso"
                    className="shrink-0 p-1 rounded-full hover:bg-surface-muted transition-colors cursor-pointer"
                >
                    <X size={15} />
                </button>
            )}
        </div>
    );
}
