import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Minus, Plus, PackageSearch, Check, RotateCcw, ChevronDown } from "lucide-react";

// Selector de materiales para préstamos (modo multi-material).
// Reemplaza al dropdown con checkboxes: lista visible con buscador,
// filtros por tipo, stock a la vista y cantidad integrada en cada fila.
//
// Contrato idéntico al que espera LoanRegisterForm:
//   onChange({ target: { name, value: string[] } })  — ids como string
//   onQuantityChange(id, "cantidad")                 — cantidad como string
const TYPE_STYLES = {
    Consumo: "bg-brand/8 text-brand border border-brand/40",
    Devolutivo: "bg-success/8 text-success border border-success/40",
};

const FILTERS = [
    { id: "all", label: "Todos" },
    { id: "Consumo", label: "Consumo" },
    { id: "Devolutivo", label: "Devolutivo" },
    { id: "selected", label: "Seleccionados" },
];

function isSelected(value, id) {
    return value.some((v) => String(v) === String(id));
}

function StockBadge({ stock }) {
    if (stock == null) return null;
    if (stock <= 0) {
        return (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none bg-error/10 text-error border border-error/40">
                Agotado
            </span>
        );
    }
    if (stock <= 5) {
        return (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none bg-warning/10 text-warning border border-warning/40">
                ¡Solo {stock}!
            </span>
        );
    }
    return (
        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none bg-surface-muted text-text-muted border border-border">
            {stock} disp.
        </span>
    );
}

function QuantityStepper({ materialId, stock, value, onChange, error }) {
    const current = Number.parseInt(value, 10);
    const safe = Number.isFinite(current) && current > 0 ? current : 1;
    const max = stock ?? 999999;

    const set = (next) => {
        const clamped = Math.min(Math.max(1, next), max);
        onChange(materialId, String(clamped));
    };

    return (
        <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
            <div
                className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-1 py-0.5 bg-surface-hover ${error ? "border-error" : "border-border"}`}
                role="group"
                aria-label="Cantidad a prestar"
            >
                <button
                    type="button"
                    aria-label="Reducir cantidad"
                    disabled={safe <= 1}
                    onClick={() => set(safe - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-sm text-text-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <Minus size={14} />
                </button>
                <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Cantidad"
                    value={value ?? "1"}
                    onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                        if (digits === "") onChange(materialId, "");
                        else set(Number(digits));
                    }}
                    onBlur={() => { if (!value) onChange(materialId, "1"); }}
                    className="w-10 text-center text-small bg-transparent focus:outline-none text-text-primary"
                />
                <button
                    type="button"
                    aria-label="Aumentar cantidad"
                    disabled={safe >= max}
                    onClick={() => set(safe + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-sm text-text-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus size={14} />
                </button>
            </div>
            {error && <p className="text-error text-small text-right leading-tight max-w-40">{error}</p>}
        </div>
    );
}

export default function MaterialPicker({
    label,
    name,
    options = [],
    value = [],
    quantities = {},
    error,
    quantityErrors = {},
    onChange,
    onQuantityChange,
    required,
    disabled = false,
}) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    // Cerrar al hacer clic fuera o pulsar Escape.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggle = (id) => {
        if (disabled) return;
        const sid = String(id);
        const next = isSelected(value, sid)
            ? value.filter((v) => String(v) !== sid)
            : [...value, sid];
        onChange({ target: { name, value: next } });
    };

    const counts = useMemo(() => {
        const c = { all: options.length, Consumo: 0, Devolutivo: 0, selected: value.length };
        for (const opt of options) {
            if (opt.type === "Consumo") c.Consumo += 1;
            if (opt.type === "Devolutivo") c.Devolutivo += 1;
        }
        return c;
    }, [options, value.length]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return options.filter((opt) => {
            if (filter === "selected" && !isSelected(value, opt.id)) return false;
            if ((filter === "Consumo" || filter === "Devolutivo") && opt.type !== filter) return false;
            if (q && !String(opt.label ?? opt.name ?? "").toLowerCase().includes(q)) return false;
            return true;
        });
    }, [options, search, filter, value]);

    const totalUnits = value.reduce((acc, id) => acc + (Number(quantities[String(id)]) || 0), 0);

    const clearAll = () => {
        if (disabled || value.length === 0) return;
        onChange({ target: { name, value: [] } });
    };

    return (
        <div className="w-full" ref={rootRef}>
            {/* ── Encabezado ── */}
            <div className="flex items-center justify-between gap-2 mb-1">
                {label && (
                    <label className={`flex items-center text-small leading-none ${error ? "text-error" : "text-text-primary"}`}>
                        {label}
                        {required && <span className="text-error ml-1">*</span>}
                    </label>
                )}
                <div className="flex items-center gap-2">
                    {value.length > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/40">
                            {value.length} elegido{value.length === 1 ? "" : "s"}
                        </span>
                    )}
                    {value.length > 0 && (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="flex items-center gap-1 text-small text-text-muted hover:text-error transition-colors"
                        >
                            <RotateCcw size={13} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Botón desplegable ── */}
            <button
                type="button"
                aria-expanded={open}
                aria-controls="material-picker-panel"
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                className={`
                    w-full
                    flex items-center justify-between gap-2
                    h-[var(--size-control-md)]
                    rounded-[var(--radius-md)]
                    border
                    px-3
                    bg-surface-hover
                    focus:outline-none
                    focus:ring-2
                    focus:border-focus-border
                    transition-colors
                    ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                    ${error ? "border-error" : "border-border"}
                    ${value.length === 0 ? "text-text-muted" : "text-text-primary"}
                `}
            >
                <span className="truncate text-left flex-1 text-small">
                    {value.length === 0
                        ? "Seleccionar materiales…"
                        : `${value.length} material${value.length === 1 ? "" : "es"} · ${totalUnits} unidad${totalUnits === 1 ? "" : "es"}`}
                </span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
            <div
                id="material-picker-panel"
                className={`mt-1 rounded-[var(--radius-md)] border bg-surface-hover animate-slide-down ${error ? "border-error" : "border-border"}`}
            >
                {/* ── Buscador ── */}
                <div className="p-2 pb-1">
                    <div className="relative">
                        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar material por nombre…"
                            aria-label="Buscar material"
                            className="w-full h-9 rounded-[var(--radius-md)] border border-border bg-surface-hover pl-8 pr-2 text-small text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:border-focus-border"
                        />
                    </div>
                    {/* ── Filtros ── */}
                    <div className="flex flex-wrap gap-1.5 mt-2" role="tablist" aria-label="Filtrar por tipo">
                        {FILTERS.map((f) => {
                            const active = filter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setFilter(f.id)}
                                    className={`text-small px-2.5 py-1 rounded-full border transition-colors ${
                                        active
                                            ? "bg-text-primary text-background border-text-primary font-medium"
                                            : "bg-surface-hover text-text-secondary border-border hover:border-text-muted"
                                    }`}
                                >
                                    {f.label}
                                    <span className={`ml-1 text-[11px] ${active ? "opacity-70" : "text-text-muted"}`}>
                                        {counts[f.id] ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Lista ── */}
                <ul className="max-h-72 overflow-y-auto p-2 pt-1 flex flex-col gap-1" aria-label={label ?? "Materiales"}>
                    {visible.map((opt) => {
                        const sid = String(opt.id);
                        const selected = isSelected(value, sid);
                        const outOfStock = opt.available_quantity != null && opt.available_quantity <= 0;
                        const name = String(opt.label ?? opt.name ?? "").replace(/\s*\(\d+\s*disponibles\)\s*$/i, "");
                        return (
                            <li key={sid}>
                                <div
                                    role="checkbox"
                                    aria-checked={selected}
                                    aria-disabled={outOfStock || disabled}
                                    tabIndex={outOfStock || disabled ? -1 : 0}
                                    onClick={() => { if (!outOfStock) toggle(sid); }}
                                    onKeyDown={(e) => {
                                        if ((e.key === " " || e.key === "Enter") && !outOfStock) {
                                            e.preventDefault();
                                            toggle(sid);
                                        }
                                    }}
                                    className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-[var(--radius-md)] border transition-colors ${
                                        outOfStock || disabled
                                            ? "opacity-50 cursor-not-allowed border-transparent"
                                            : "cursor-pointer"
                                    } ${
                                        selected
                                            ? "bg-brand/8 border-brand/40"
                                            : "border-transparent hover:bg-surface-muted"
                                    }`}
                                >
                                    {/* Casilla */}
                                    <span
                                        aria-hidden
                                        className={`w-5 h-5 shrink-0 rounded-[6px] border flex items-center justify-center transition-colors ${
                                            selected ? "bg-text-primary border-text-primary text-background" : "border-border bg-surface-hover"
                                        }`}
                                    >
                                        {selected && <Check size={14} strokeWidth={3} />}
                                    </span>
                                    {/* Nombre + badges */}
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-small text-text-primary leading-snug break-words">
                                            {name}
                                        </span>
                                        <span className="flex flex-wrap items-center gap-1 mt-1">
                                            {opt.type && (
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none ${TYPE_STYLES[opt.type] ?? "bg-surface-muted text-text-muted border border-border"}`}>
                                                    {opt.type}
                                                </span>
                                            )}
                                            <StockBadge stock={opt.available_quantity} />
                                        </span>
                                    </span>
                                    {/* Cantidad integrada */}
                                    {selected && !outOfStock && (
                                        <QuantityStepper
                                            materialId={sid}
                                            stock={opt.available_quantity}
                                            value={quantities[sid]}
                                            onChange={onQuantityChange}
                                            error={quantityErrors?.[sid] ?? quantityErrors?.[opt.id]}
                                        />
                                    )}
                                </div>
                            </li>
                        );
                    })}
                    {visible.length === 0 && (
                        <li className="flex flex-col items-center gap-2 py-8 text-text-muted">
                            <PackageSearch size={28} />
                            <p className="text-small text-center px-4">
                                {options.length === 0
                                    ? "No hay materiales disponibles para prestar."
                                    : search.trim() || filter !== "all"
                                        ? "Sin resultados. Prueba con otra búsqueda o filtro."
                                        : "No hay materiales en esta categoría."}
                            </p>
                        </li>
                    )}
                </ul>

                {/* ── Pie ── */}
                {value.length > 0 && (
                    <div className="px-3 py-2 border-t border-border text-small text-text-muted">
                        {value.length} material{value.length === 1 ? "" : "es"} · {totalUnits} unidad{totalUnits === 1 ? "" : "es"} en total
                    </div>
                )}
            </div>
            )}

            {error && <p className="text-error text-small place-self-start mt-1">{error}</p>}
        </div>
    );
}
