export default function Input({
    label,
    labelAction,
    type = "text",
    required,
    optional,
    className = "w-full",
    error,
    hint,
    variant = "default",
    endAdornment,
    inputClassName = "",
    ...props
}){
    // Estilos del input segun la variante. "default" mantiene el look de
    // los formularios CRUD; "auth" replica el de las pantallas de sesion
    // (placeholder, esquinas mas redondeadas y altura menor).
    const inputVariants = {
        default: `
            h-[var(--size-control-md)]
            rounded-[var(--radius-md)]
            text-body
        `,
        auth: `
            h-[var(--size-control-lg)]
            rounded-[var(--radius-xl)]
            text-small
        `,
    };

    return(
        <div className={className}>
            {label && (
                <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                        className={`
                            block
                            place-self-start
                            text-small
                            ${error ? "text-error" : "text-text-primary"}
                        `}
                    >
                        {label}
                        {required && <span className="text-error ml-1">*</span>}
                    </label>
                    {labelAction}
                </div>
            )}

            <div className={`relative flex items-center ${variant === "auth" ? "h-[var(--size-control-lg)]" : "h-[var(--size-control-md)]"}`}>
                <input
                    type={type}
                    required={required}
                    className={`
                        relative
                        w-full
                        h-full
                        box-border
                        ${inputVariants[variant]}
                        border
                        px-4
                        ${endAdornment ? "pr-10" : ""}
                        bg-surface-hover
                        text-text-primary
                        placeholder:text-text-muted
                        focus:outline-none
                        focus:ring-2
                        focus:ring-focus-ring
                        focus:border-focus-border
                        ${error ? "border-error" : "border-border"}
                        ${inputClassName}
                    `}
                    {...props}
                />

                {/* Slot opcional a la derecha (icono decorativo o boton, ej. ver contraseña) */}
                {endAdornment && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-text-muted">
                        {endAdornment}
                    </span>
                )}
            </div>

            {error && (
                <p className={`text-error text-small place-self-start mt-1 ${variant === "auth" ? "pl-1" : ""}`}>
                    {error}
                </p>
            )}

            {!error && hint && (
                <p className="text-text-muted text-small place-self-start mt-1">
                    {hint}
                </p>
            )}
        </div>
    )
};
