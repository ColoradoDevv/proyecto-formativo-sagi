import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, FileText, PackageSearch, Upload, X, ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Input, Modal, SearchField, Select, showAlert } from "@/shared";
import { getQuotations, getQuotationById } from "../services/quotationService";
import { mediaUrl } from "@/shared/services/api";

const MAX_SELECTED = 3;
const PAGE_SIZE = 4;

const ORDER_OPTIONS = [
    { id: "-uploaded_at", label: "Recientes primero" },
    { id: "uploaded_at", label: "Antiguos primero" },
    { id: "title", label: "Nombre A–Z" },
    { id: "-title", label: "Nombre Z–A" },
];

// Selector de cotizaciones en modal: mismo contrato que el picker anterior
//   onChange({ target: { name, value: string[] } })  — ids como string
// pero escalable a miles de archivos: búsqueda en servidor, pestañas
// (Disponibles/Todas), paginación local y previsualización. La selección
// se confirma con el botón (cancelar la descarta).
export default function QuotationPickerModal({
    label = "Cotizaciones",
    name = "quotations",
    value = [],
    error,
    onChange,
    required,
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [known, setKnown] = useState({}); // id -> objeto (para chips)
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("available"); // available | all
    const [ordering, setOrdering] = useState("-uploaded_at");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(0);
    const [draft, setDraft] = useState([]);
    const searchTimer = useRef(null);

    const isSelected = (id, list = draft) => list.some((v) => String(v) === String(id));
    const displayName = (q) => q.title || String(q.url ?? "").split("/").pop() || `Cotización ${q.id}`;

    const remember = (list) => {
        setKnown((prev) => {
            const next = { ...prev };
            for (const q of list) next[String(q.id)] = q;
            return next;
        });
    };

    const fetchItems = async (opts = {}) => {
        const controller = new AbortController();
        setLoading(true);
        try {
            const data = await getQuotations({
                unassigned: (opts.tab ?? tab) === "available",
                search: opts.search ?? search,
                ordering: opts.ordering ?? ordering,
                signal: controller.signal,
            });
            setItems(data);
            remember(data);
        } catch (err) {
            if (err.name !== "AbortError") {
                setItems([]);
                await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudieron cargar las cotizaciones", text: err.message });
            }
        } finally {
            setLoading(false);
        }
        return () => controller.abort();
    };

    // Al abrir: borrador = selección actual, resolver elegidas desconocidas.
    const openModal = async () => {
        if (disabled) return;
        setDraft(value.map(String));
        setSearch("");
        setTab("available");
        setOrdering("-uploaded_at");
        setDateFrom("");
        setDateTo("");
        setPage(0);
        setOpen(true);
        const missing = value.map(String).filter((id) => !known[id]);
        if (missing.length > 0) {
            try {
                const resolved = await Promise.all(missing.map((id) => getQuotationById(id).catch(() => null)));
                remember(resolved.filter(Boolean));
            } catch { /* las no resueltas se muestran como #id */ }
        }
    };

    useEffect(() => {
        if (!open) return;
        const cleanup = fetchItems();
        return () => { cleanup?.then?.((fn) => fn?.()); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open ]);

    const handleSearch = (next) => {
        setSearch(next);
        setPage(0);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            fetchItems({ search: next });
        }, 400);
    };

    const handleTab = (next) => {
        setTab(next);
        setPage(0);
        fetchItems({ tab: next });
    };

    const handleOrdering = (e) => {
        const next = e.target.value;
        setOrdering(next);
        setPage(0);
        fetchItems({ ordering: next });
    };

    const clearFilters = () => {
        setSearch("");
        setTab("available");
        setOrdering("-uploaded_at");
        setDateFrom("");
        setDateTo("");
        setPage(0);
        fetchItems({ search: "", tab: "available", ordering: "-uploaded_at" });
    };

    const hasActiveFilters =
        search.trim() !== "" || tab !== "available" || ordering !== "-uploaded_at" ||
        dateFrom !== "" || dateTo !== "";

    // Disponibles + las del borrador (para no perder una asignada a otro material).
    const draftSet = useMemo(() => new Set(draft.map(String)), [draft]);
    const options = useMemo(() => {
        const dayOf = (iso) => String(iso ?? "").slice(0, 10);
        return items.filter((q) => {
            if (q.material != null && !draftSet.has(String(q.id))) return false;
            const day = dayOf(q.uploaded_at);
            if (dateFrom && day < dateFrom) return false;
            if (dateTo && day > dateTo) return false;
            return true;
        });
    }, [items, draftSet, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = options.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    const toggle = (id) => {
        const sid = String(id);
        setDraft((prev) => {
            const has = prev.some((v) => String(v) === sid);
            if (has) return prev.filter((v) => String(v) !== sid);
            if (prev.length >= MAX_SELECTED) return prev;
            return [...prev, sid];
        });
    };

    const handleConfirm = () => {
        onChange({ target: { name, value: draft.map(String) } });
        setOpen(false);
    };

    const removeChip = (id) => {
        onChange({ target: { name, value: value.filter((v) => String(v) !== String(id)) } });
    };

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

            {/* Elegidas */}
            {value.length > 0 && (
                <ul className="flex flex-col gap-1.5 mb-2">
                    {value.map((id) => {
                        const q = known[String(id)];
                        return (
                            <li
                                key={id}
                                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-brand/40 bg-brand/8 px-2.5 py-1.5"
                            >
                                <FileText size={14} className="text-brand shrink-0" />
                                <span className="flex-1 min-w-0 text-small text-text-primary truncate" title={q ? displayName(q) : `#${id}`}>
                                    {q ? displayName(q) : `Cotización #${id}`}
                                </span>
                                {q && (
                                    <a
                                        href={mediaUrl(q.url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 text-small text-brand hover:underline underline-offset-2"
                                    >
                                        Ver
                                    </a>
                                )}
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => removeChip(id)}
                                        aria-label="Quitar cotización"
                                        className="shrink-0 p-0.5 text-text-muted hover:text-error transition-colors cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={openModal}
                disabled={disabled}
                className="w-full"
            >
                <PackageSearch size={16} />
                {value.length === 0 ? "Elegir cotizaciones" : "Cambiar selección"}
            </Button>
            {error && <p className="text-error text-small place-self-start mt-1">{error}</p>}

            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                title="Elegir cotizaciones"
                variant="solid"
                size="xl"
                footer={
                    <>
                        <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" variant="primary" size="md" onClick={handleConfirm}>
                            Confirmar ({draft.length}/{MAX_SELECTED})
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <SearchField
                        placeholder="Buscar por título o archivo…"
                        value={search}
                        onChange={handleSearch}
                        fullWidth
                    />

                    {/* Orden y fechas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Select
                            label="Ordenar por"
                            name="quotation-order"
                            options={ORDER_OPTIONS}
                            value={ordering}
                            onChange={handleOrdering}
                        />
                        <Input
                            label="Desde"
                            name="quotation-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                            optional
                        />
                        <Input
                            label="Hasta"
                            name="quotation-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                            optional
                        />
                    </div>

                    {/* Pestañas */}
                    <div className="inline-flex self-start rounded-[var(--radius-lg)] border border-border overflow-hidden">
                        {[
                            { id: "available", label: "Disponibles" },
                            { id: "all", label: "Todas" },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleTab(t.id)}
                                className={
                                    "px-4 py-2 text-small font-medium transition-colors cursor-pointer " +
                                    (tab === t.id
                                        ? "bg-brand text-on-brand"
                                        : "bg-surface-hover text-text-secondary hover:bg-surface-muted") +
                                    (t.id !== "available" ? " border-l border-border" : "")
                                }
                            >
                                {t.label}
                            </button>
                        ))}
                        <span className="px-3 py-2 text-small text-text-muted border-l border-border">
                            {options.length} resultado(s)
                        </span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="px-3 py-2 text-small text-brand hover:underline underline-offset-2 border-l border-border cursor-pointer whitespace-nowrap"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    {/* Lista paginada */}
                    {loading ? (
                        <p className="text-small text-text-muted text-center py-8">Cargando cotizaciones…</p>
                    ) : pageItems.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-text-muted">
                            <PackageSearch size={28} />
                            <p className="text-small text-center px-4">Sin resultados para esa búsqueda.</p>
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {pageItems.map((q) => {
                                const selected = isSelected(q.id);
                                const limitReached = !selected && draft.length >= MAX_SELECTED;
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
                            })}
                        </ul>
                    )}

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                            >
                                <ArrowLeft size={16} /> Anterior
                            </Button>
                            <span className="text-small text-text-muted">
                                Página {safePage + 1} de {totalPages}
                            </span>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage >= totalPages - 1}
                            >
                                Siguiente <ArrowRight size={16} />
                            </Button>
                        </div>
                    )}

                    <Link
                        to="/cotizaciones"
                        className="flex items-center gap-1.5 text-small text-brand hover:underline underline-offset-2 w-fit"
                    >
                        <Upload size={13} /> Subir nuevas en el módulo Cotizaciones
                    </Link>
                </div>
            </Modal>
        </div>
    );
}
