import { ChevronDown } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownContent } from "./Dropdown";
import Checkbox from "./Checkbox";

const TYPE_STYLES = {
    Consumo:    "bg-brand/8 text-brand border border-brand/40",
    Devolutivo: "bg-success/8 text-success border border-success/40",
};

function TypeBadge({ type }) {
    if (!type) return null;
    return (
        <span className={`shrink-0 text-small font-medium px-1.5 py-0.5 rounded-full leading-none ${TYPE_STYLES[type] ?? "bg-surface-muted text-text-muted border border-border"}`}>
            {type}
        </span>
    );
}

const MAX_OPTION_LENGTH = 40;

function truncateLabel(label, max = MAX_OPTION_LENGTH) {
    if (typeof label !== "string" || label.length <= max) return label;
    return `${label.slice(0, max)}…`;
}

export default function SelectMultiple({
    label,
    labelAction,
    name,
    error,
    value = [],
    className = "",
    onChange,
    required,
    disabled = false,
    options = [],
}) {
    const toggle = (id) => {
        if (disabled) return;
        const next = value.includes(id)
            ? value.filter((v) => v !== id)
            : [...value, id];
        onChange({ target: { name, value: next } });
    };

    const selectedLabels = options
        .filter((opt) => value.includes(String(opt.id)))
        .map((opt) => opt.label);

    return (
        <div className={className || "w-full"}>
            {label && (
            <div className="flex items-center justify-between gap-2">
                <label
                    htmlFor={name ? `${name}-trigger` : undefined}
                    className={`
                        flex items-center
                        text-small leading-none
                        ${error ? "text-error" : "text-text-primary"}
                    `}
                >
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                </label>
                {labelAction}
            </div>
            )}

            <Dropdown className="block w-full">
                <DropdownTrigger
                    id={name ? `${name}-trigger` : undefined}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error && name ? `${name}-error` : undefined}
                    className={`
                        w-full
                        justify-between
                        h-[var(--size-control-md)]
                        rounded-[var(--radius-md)]
                        border
                        px-8
                        bg-surface-hover
                        focus:outline-none
                        focus:ring-2
                        focus:border-focus-border
                        ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}
                        ${error ? "border-error" : "border-border"}
                        ${selectedLabels.length === 0 ? "text-text-muted" : "text-text-primary"}
                    `}
                    disabled={disabled}
                >
                    <span className="truncate text-left flex-1">
                        {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Seleccione una opción"}
                    </span>
                    <ChevronDown size={16} className="shrink-0" />
                </DropdownTrigger>

                <DropdownContent align="left" matchTriggerWidth className="max-h-60 overflow-y-auto">
                    {options.map((opt) => (
                        <Checkbox
                            key={opt.id}
                            id={`${name}-${opt.id}`}
                            name={name}
                            label={
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{truncateLabel(opt.label)}</span>
                                    <TypeBadge type={opt.type} />
                                </span>
                            }
                            title={opt.label}
                            checked={value.includes(String(opt.id))}
                            onChange={() => toggle(String(opt.id))}
                            className="px-3 py-2 hover:bg-surface-muted rounded-sm w-full"
                        />
                    ))}
                </DropdownContent>
            </Dropdown>

            {error && (
                <p id={name ? `${name}-error` : undefined} role="alert" className="text-error text-small place-self-start mt-1">
                    {error}
                </p>
            )}
        </div>
    );
}
