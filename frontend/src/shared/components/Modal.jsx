import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

// Estilos por variante: "glass" (translucido, look de los modales de features)
// y "solid" (tarjeta opaca, mejor legibilidad y tema oscuro).
const VARIANTS = {
    glass: {
        backdrop: "bg-background-inverse/20 backdrop-blur-xs",
        card: "bg-surface-hover/30 backdrop-blur-2xl border border-surface-hover/50",
    },
    solid: {
        backdrop: "bg-background-inverse/30",
        card: "bg-surface-hover border border-border",
    },
};

// Ancho maximo de la tarjeta segun el tamaño solicitado.
const SIZES = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
};

// Modal centralizado y reutilizable.
// Encapsula: portal, overlay, cierre con Escape / click fuera, bloqueo de
// scroll del body, y accesibilidad basica (role dialog + aria).
//
// Uso:
//   <Modal isOpen={open} onClose={close} title="Editar" footer={<...>}>
//       ...contenido...
//   </Modal>
export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    footer,
    variant = "glass",
    size = "md",
    closeOnBackdrop = true,
    showClose = true,
}) {
    const titleId = useId();

    // Cierre con tecla Escape.
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    // Bloquea el scroll del body mientras el modal esta abierto.
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    if (!isOpen) return null;

    const styles = VARIANTS[variant] ?? VARIANTS.glass;
    const maxWidth = SIZES[size] ?? SIZES.md;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            {/* Backdrop: click fuera para cerrar (si esta habilitado) */}
            <div
                className={`absolute inset-0 ${styles.backdrop}`}
                onClick={closeOnBackdrop ? onClose : undefined}
            />

            {/* Tarjeta */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={`relative z-10 w-full ${maxWidth} max-h-[90vh] overflow-y-auto ${styles.card} rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] p-6 sm:p-8 flex flex-col gap-5 animate-slide-up`}
            >
                {/* Header */}
                {(title || showClose) && (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <h2 id={titleId} className="text-h3 font-heading text-text-primary">
                                {title}
                            </h2>
                            {showClose && (
                                <IconButton type="button" variant="secondary" onClick={onClose} ariaLabel="Cerrar">
                                    <X size={16} />
                                </IconButton>
                            )}
                        </div>
                        <div className="w-full h-px bg-border" />
                    </>
                )}

                {/* Contenido */}
                {children}

                {/* Footer opcional */}
                {footer && (
                    <>
                        <div className="w-full h-px bg-border" />
                        <div className="flex gap-3 justify-end">
                            {footer}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
