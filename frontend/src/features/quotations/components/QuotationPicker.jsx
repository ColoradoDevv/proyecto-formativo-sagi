import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Check, PackageSearch, Upload } from "lucide-react";
import { getQuotations } from "../services/quotationService";
import { mediaUrl } from "@/shared/services/api";

const MAX_SELECTED = 3;

// Selector de cotizaciones de la biblioteca para los formularios de
// materiales. Mismo contrato que los demás pickers:
//   onChange({ target: { name, value: string[] } })  — ids como string
// Muestra las disponibles + las ya elegidas (aunque estén asignadas),
// con buscador y previsualización. Para subir nuevas redirige al módulo.
export default function QuotationPicker({
    label = "Cotizaciones",
    name = "quotations",
    value = [],
    error,
    onChange,
    required,
    disabled = false,
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        getQuotations({ signal: controller.signal })
            .then(setItems)
            .catch((err) => {
                if (err.name !== "AbortError") setItems([]);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, []);

    const isSelected = (id) => value.some((v) => String(v) === String(id));

    // Disponibles + las elegidas (una elegida por otro material no debería
    // pasar la validación del backend, pero se muestra para no perderla).
    const options = useMemo(() => {
        const selectedIds = new Set(value.map(String));
        return items.filter((q) => q.material == null || selectedIds.has(String(q.id)));
    }, [items, value]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter((item) =>
            `${item.title ?? ""} ${item.url ?? ""}`.toLowerCase().includes(q)
        );
    }, [options, search]);

    const toggle = (id) => {
        if (disabled) return;
        const sid = String(id);
        const next = isSelected(sid)
            ? value.filter((v) => String(v) !== sid)
            : [...value, sid];
        onChange({ target: { name, value: next } });
    };

    const displayName = (q) => q.title || String(q.url ?? "").split("/").pop() || `Cotización ${q.id}`;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between gap-2 mb-1">
                {label && (
                    <label className={`flex items-center text-small leading-none ${error ? "text-error" : "text-text-primary"}`}>
                        {label}
                        {required && <span className="text-error ml-1">*</span>}
                    </label>
                )}
                {value.length > 0 && (
                    <span className="text-small font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/40">
                        {value.length}/{MAX_SELECTED} elegidas
                    </span>
                )}
            </div>

            <div className={`rounded-[var(--radius-md)] border bg-surface-hover ${error ? "border-error" : "border-border"}`}>
                <div className="p-2 pb-1">
                    <div className="relative">
                        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar cotización…"
                            aria-label="Buscar cotización"
                            className="w-full h-9 rounded-[var(--radius-md)] border border-border bg-surface-hover pl-8 pr-2 text-small text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:border-focus-border"
                        />
                    </div>
                </div>

                <ul className="max-h-60 overflow-y-auto p-2 pt-1 flex flex-col gap-1" aria-label={label}>
                    {loading ? (
                        <li className="text-small text-text-muted text-center py-6">Cargando cotizaciones…</li>
                    ) : (
                        visible.map((q) => {
                            const selected = isSelected(q.id);
                            const limitReached = !selected && value.length >= MAX_SELECTED;
                            const off = disabled || limitReached;
                            return (
                                <li key={q.id}>
                                    <div
                                        role="checkbox"
                                        aria-checked={selected}
                                        aria-disabled={off}
                                        tabIndex={off ? -1 : 0}
                                        onClick={() => { if (!off) toggle(q.id); }}
                                        onKeyDown={(e) => {
                                            if ((e.key === " " || e.key === "Enter") && !off) {
                                                e.preventDefault();
                                                toggle(q.id);
                                            }
                                        }}
                                        className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-[var(--radius-md)] border transition-colors ${
                                            off ? "opacity-50 cursor-not-allowed border-transparent" : "cursor-pointer"
                                        } ${selected ? "bg-brand/8 border-brand/40" : "border-transparent hover:bg-surface-muted"}`}
                                    >
                                        <span
                                            aria-hidden
                                            className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                                                selected ? "bg-text-primary border-text-primary text-background" : "border-border bg-surface-hover"
                                            }`}
                                        >
                                            {selected && <Check size={14} strokeWidth={3} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-small text-text-primary leading-snug break-words">
                                                {displayName(q)}
                                            </span>
                                            <span className="block text-small text-text-muted truncate">
                                                {q.material ? `Asignada a: ${q.material_name ?? "material"}` : "Disponible"}
                                            </span>
                                        </span>
                                        <a
                                            href={mediaUrl(q.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="shrink-0 text-small text-brand hover:underline underline-offset-2"
                                        >
                                            Ver
                                        </a>
                                    </div>
                                </li>
                            );
                        })
                    )}
                    {!loading && visible.length === 0 && (
                        <li className="flex flex-col items-center gap-2 py-6 text-text-muted">
                            <PackageSearch size={28} />
                            <p className="text-small text-center px-4">
                                {items.length === 0
                                    ? "Aún no hay cotizaciones subidas."
                                    : "Sin resultados para esa búsqueda."}
                            </p>
                        </li>
                    )}
                </ul>

                <div className="px-3 py-2 border-t border-border">
                    <Link
                        to="/cotizaciones"
                        className="flex items-center gap-1.5 text-small text-brand hover:underline underline-offset-2"
                    >
                        <Upload size={13} /> Subir nuevas en el módulo Cotizaciones
                    </Link>
                </div>
            </div>

            {error && <p className="text-error text-small place-self-start mt-1">{error}</p>}
        </div>
    );
}
