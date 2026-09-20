import clsx from "clsx"
import React from "react"

export const IconButton = React.forwardRef(function IconButton(
    {
        children,
        onClick,
        disabled = false,
        className = "",
        variant = "default",

        // Tamaños
        hitSize = 48,
        iconSize = 24,

        // Accesibilidad
        ariaLabel,

        // Estados
        isActive = false,

        ...props
    },
    ref
    ) {
    const baseStyles = `
        inline-flex items-center justify-center
        rounded-[var(--radius-full)]
        transition-colors duration-[var(--duration-base)]
        cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none

    `

    const variants = {
        default: `
            text-text-inverse
            hover:bg-surface-muted
            hover:text-text-primary
            focus-visible:ring-focus-ring
        `,
        ghost: `
            text-text-secondary
            hover:bg-surface-muted
            focus-visible:ring-focus-ring
        `,
        primary: `
            text-text-inverse bg-brand
            hover:bg-brand-hover
            focus-visible:ring-focus-ring
            cursor-pointer
        `,

    }

    return (
        <button
            ref={ref}
            type="button"
            aria-label={ariaLabel}
            onClick={onClick}
            disabled={disabled}
            className={clsx(baseStyles, variants[variant], className, {
                "bg-surface-muted": isActive,
            })}
            style={{
                width: `${hitSize}px`,
                height: `${hitSize}px`,
            }}
            {...props}
        >
            <span
                style={{
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                }}
                className="flex items-center justify-center"
                >
                {children}
            </span>
        </button>
    )
})
