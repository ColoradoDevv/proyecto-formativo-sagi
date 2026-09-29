import { forwardRef } from "react";
import { Search, X, LoaderCircle } from "lucide-react";
import clsx from "clsx";

const baseStyles = "search flex items-center rounded-[var(--radius-xl)] px-4 transition-all border";

const sizeStyles = {
    sm: "h-[var(--size-control-sm)] text-small",
    md: "h-[var(--size-control-md)] text-body",
    lg: "h-[var(--size-control-2xl)] text-body",
};

const variantStyles = {
    filled: "bg-surface-muted border-border hover:border-border-hover focus-within:bg-surface-hover",
    outlined: "bg-surface-hover border-border hover:border-border-hover",
};

const SearchField = forwardRef(
    (
        {
            value = "",
            placeholder = "Buscar",
            onChange = () => {},
            onSubmit,
            onClear = () => {},
            size = "md",
            variant = "filled",
            fullWidth = false,
            disabled = false,
            loading = false,
            error = false,
            name = "search",
            ariaLabel = "Campo de búsqueda",
            autoComplete = "off",
            icon,
            className,
        },
        ref
    ) => {
        const SearchIcon = icon || Search;

        const handleClear = () => {
            onChange("");
            onClear();
        };

        const handleSubmit = (e) => {
            e.preventDefault();
            if (disabled || loading) return;
            onSubmit?.(value);
        };

        return(
            <form
                onSubmit={handleSubmit}
                className={clsx(
                    baseStyles,
                    sizeStyles[size],
                    variantStyles[variant],
                    fullWidth && "w-full",
                    disabled && "opacity-60 pointer-events-none",
                    error
                        ? "border-error focus-within:ring-2 focus-within:ring-error"
                        : "focus-within:ring-2 focus-within:ring-focus-ring",
                    className,
                )}
            >
                {loading ? (
                    <LoaderCircle className="size-5 shrink-0 animate-spin text-text-muted" />
                ): (
                    <SearchIcon className="size-5 shrink-0 text-text-muted" />
                )}

                <input
                    ref={ref}
                    type="search"
                    name={name}
                    value={value}
                    disabled={disabled}
                    placeholder={placeholder}
                    aria-label={ariaLabel}
                    autoComplete={autoComplete}
                    onChange={(e) => onChange(e.target.value)}
                    className="search__input flex-1 bg-transparent px-3 outline-none"
                />

                {!!value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        aria-label="Limpiar búsqueda"
                        className="search__clear rounded-full p-1 hover:bg-surface-muted"
                    >
                        <X className="size-5 text-text-muted" />
                    </button>
                )}

            </form>
        );
    }
);

SearchField.displayName = "SearchField";

export default SearchField;
