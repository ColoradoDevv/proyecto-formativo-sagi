import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { createPortal } from "react-dom"
import { useClickOutside } from "@/shared/hooks/useClickOutside"

// ─── Context ────────────────────────────────────────────────────────────────

const DropdownContext = createContext(null)

// ─── Dropdown (root) ────────────────────────────────────────────────────────

export function Dropdown({
    children,
    open: controlledOpen,
    onOpenChange,
    className = "",
    triggerRef: externalTriggerRef,
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : uncontrolledOpen

    const setOpen = useCallback(
        (value) => {
            if (isControlled) {
                onOpenChange?.(value)
            } else {
                setUncontrolledOpen(value)
            }
        },
        [isControlled, onOpenChange]
    )

    const containerRef = useRef(null)
    const internalTriggerRef = useRef(null)
    const triggerRef = externalTriggerRef ?? internalTriggerRef
    const contentRef   = useRef(null)

    useClickOutside({
        containerRef,
        contentRef,
        isActive: open,
        onClose: () => setOpen(false),
    })

    // Cierre con Escape + devolver el foco al trigger (WCAG 2.1.1).
    useEffect(() => {
        if (!open) return
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                setOpen(false)
                triggerRef.current?.focus?.()
            }
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [open, setOpen, triggerRef, contentRef])

    return (
        <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
            <div
                ref={containerRef}
                className={`relative inline-block ${className}`}
            >
                {children}
            </div>
        </DropdownContext.Provider>
    )
}

// ─── DropdownTrigger ─────────────────────────────────────────────────────────

export function DropdownTrigger({ children, className = "", ...rest }) {
    const { open, setOpen, triggerRef } = useContext(DropdownContext)

    return (
        <button
            type="button"
            ref={triggerRef}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`flex items-center gap-1 cursor-pointer ${className}`}
            {...rest}
        >
            {children}
        </button>
    )
}

// ─── DropdownContent ─────────────────────────────────────────────────────────
// Usa un portal para renderizar fuera del DOM de la tabla y evitar que
// overflow:hidden/auto del contenedor padre recorte el menú.

export function DropdownContent({ children, className = "", align = "right", matchTriggerWidth = false }) {
    const { open, triggerRef, contentRef } = useContext(DropdownContext)
    const [style, setStyle] = useState({ position: "fixed", top: -9999, left: -9999, visibility: "hidden" })

    useEffect(() => {
        if (!open) return

        const frame = requestAnimationFrame(() => {
            if (!contentRef.current || !triggerRef?.current) return

            const triggerRect   = triggerRef.current.getBoundingClientRect()
            const contentHeight = contentRef.current.offsetHeight
            const contentWidth  = matchTriggerWidth ? triggerRect.width : contentRef.current.offsetWidth

            // Si el trigger no tiene dimensiones válidas (no está pintado todavía
            // o está oculto), no calculamos posición — dejamos el contenido oculto.
            if (triggerRect.width === 0 || triggerRect.height === 0) return

            const spaceBelow = window.innerHeight - triggerRect.bottom
            const spaceAbove = triggerRect.top

            const goUp = spaceBelow < contentHeight && spaceAbove > spaceBelow

            const top = goUp
                ? Math.max(8, triggerRect.top - contentHeight - 4)
                : triggerRect.bottom + 4

            const left = align === "right"
                ? Math.max(8, triggerRect.right - contentWidth)
                : Math.min(triggerRect.left, window.innerWidth - contentWidth - 8)

            setStyle({
                position: "fixed",
                top,
                left,
                visibility: "visible",
                ...(matchTriggerWidth ? { width: triggerRect.width } : {}),
            })
        })

        return () => cancelAnimationFrame(frame)
    }, [open, triggerRef, align, matchTriggerWidth])

    if (!open) return null

    return createPortal(
        <div
            ref={contentRef}
            role="menu"
            style={style}
            className={`
                z-50
                min-w-48
                border border-border
                text-text-primary
                p-2
                bg-surface-hover/80
                backdrop-blur-[10px]
                shadow-[var(--shadow-elevation-3)]
                rounded-[var(--radius-sm)]
                overflow-hidden
                hover:shadow-[var(--shadow-elevation-4)]
                transition-shadow
                duration-[var(--duration-lazy)]
                ${className}
            `}
        >
            {children}
        </div>,
        document.body
    )
}

// ─── DropdownItem ─────────────────────────────────────────────────────────────

export function DropdownItem({
    children,
    onClick,
    className = "",
}) {
    const { setOpen } = useContext(DropdownContext)

    const handleClick = (e) => {
        onClick?.(e)
        setOpen(false)
    }

    return (
        <button
            type="button"
            role="menuitem"
            onClick={handleClick}
            className={`w-full text-left px-3 py-2 cursor-pointer rounded-sm text-medium
                hover:bg-surface-muted
                focus:bg-surface-muted transition-colors ${className}`}
        >
            {children}
        </button>
    )
}

// ─── DropdownSeparator ─────────────────────────────────────────────────────────

export function DropdownSeparator({ className = "" }) {
    return <div className={`my-1 h-px bg-border ${className}`} />
}
