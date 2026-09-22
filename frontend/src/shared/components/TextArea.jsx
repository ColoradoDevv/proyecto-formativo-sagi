export default function TextArea({
    label,
    labelAction,
    name,
    required,
    optional,
    className = "w-full",
    error,
    hint,
    rows = 4,
    ...props
}){
    return(
        <div className={className}>
            {label && (
                <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                        htmlFor={name ?? "field"}
                        className={`
                            block
                            place-self-start
                            text-small
                            ${error ? "text-error" : "text-text-primary"}
                        `}
                    >
                        {label}
                        {required && <span className="text-error ml-1">*</span>}
                        {!required && optional && (
                            <span className="ml-1.5 text-[11px] font-normal text-text-muted">(Opcional)</span>
                        )}
                    </label>
                    {labelAction}
                </div>
            )}

            <div className="relative flex items-center">
                <textarea
                    id={name ?? "field"}
                    name={name}
                    required={required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                        error ? `${name ?? "field"}-error`
                        : hint ? `${name ?? "field"}-hint`
                        : undefined
                    }
                    rows={rows}
                    className={`
                        relative
                        w-full
                        rounded-[var(--radius-md)]
                        border
                        px-4
                        py-2
                        text-body
                        bg-surface-hover
                        placeholder:text-text-muted
                        resize-none
                        focus:outline-none
                        focus:ring-2
                        focus:ring-focus-ring
                        focus:border-focus-border
                        ${error ? "border-error" : "border-border"}
                    `}
                    {...props}
                />
            </div>

            {error && (
                <p id={`${name ?? "field"}-error`} role="alert" className="text-error text-small place-self-start mt-1">
                    {error}
                </p>
            )}

            {!error && hint && (
                <p id={`${name ?? "field"}-hint`} className="text-text-muted text-small place-self-start mt-1">
                    {hint}
                </p>
            )}
        </div>
    )
};
