const MAX_OPTION_LENGTH = 40;

function truncateLabel(label, max = MAX_OPTION_LENGTH) {
    if (typeof label !== "string" || label.length <= max) return label;
    return `${label.slice(0, max)}…`;
}

export default function Select({
    label,
    labelAction,
    name,
    error,
    value,
    className = "",
    onChange,
    optional,
    required,
    disabled = false,
    options = [],
    disabledOptionValues = [],
    placeholder = "Seleccione una opción",
}){
    return(
        <div className={className || "w-full"}>
            {label && (
                <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                        htmlFor={name ?? "field"}
                        className={`
                            block
                            place-self-center
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

            <select
                id={name ?? "field"}
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${name ?? "field"}-error` : undefined}
                className={`
                    relative
                    w-full
                    max-w-full
                    h-[var(--size-control-md)]
                    rounded-[var(--radius-md)]
                    border
                    px-8
                    bg-surface-hover
                    truncate
                    focus:outline-none
                    focus:ring-2
                    focus:border-focus-border
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    ${error ? "border-error" : "border-border"}
                    ${!value ? "text-text-muted" : "text-text-primary"}
                `}
            >
                <option value="">
                    {placeholder}
                </option>

                {options.map((opt) => {
                    const optionValue = String(opt.id);
                    const isDisabled = disabledOptionValues.includes(optionValue) || disabledOptionValues.includes(opt.id) || opt.disabled;

                    return (
                        <option
                            key={opt.id}
                            value={opt.id}
                            title={opt.label}
                            disabled={isDisabled}
                        >
                            {truncateLabel(opt.label)}
                        </option>
                    );
                })}

            </select>

            {error && (
                <p id={`${name ?? "field"}-error`} role="alert" className="text-error text-small place-self-start mt-1">
                    {error}
                </p>
            )}
        </div>
    )
}
