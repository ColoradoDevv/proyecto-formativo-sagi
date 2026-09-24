import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TailChase } from "ldrs/react";
import { Undo2, AlertTriangle, CircleCheck, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button, IconButton, Input, TextArea, showAlert } from "@/shared";
import { apiFetch } from "@/shared/services/api";
import { returnLoan } from "../../services/returnService";

const CONDITION_META = {
    Bueno:         { label: "Bueno",         style: "border-success text-success",  bg: "bg-success-soft" },
    Mantenimiento: { label: "Mantenimiento", style: "border-warning text-warning",  bg: "bg-warning-soft" },
    Baja:          { label: "Baja",          style: "border-error text-error",      bg: "bg-error-soft"   },
};
const CONDITIONS = ["Bueno", "Mantenimiento", "Baja"];

function emptyRow(loan) {
    return {
        loanId:            loan.id_loan,
        material:          loan.material,
        materialType:      loan.material_type,
        amountLent:        loan.amount_lent,
        leftoverQuantity:  "",
        returnedQuantity:  "",
        observations:      "",
        materialCondition: "Bueno",
        done:              false,   // true = ya devuelto en esta sesión
    };
}

export default function BatchReturnPage() {
    const { batchId } = useParams();
    const navigate    = useNavigate();

    const [batch,      setBatch]      = useState(null);
    const [rows,       setRows]       = useState([]);
    const [errors,     setErrors]     = useState({});  // { [loanId]: { field: msg } }
    const [submitting, setSubmitting] = useState(false);
    const [loading,    setLoading]    = useState(true);
    const [fetchError, setFetchError] = useState(null);
    // Acordeón: solo se expande lo que se está trabajando (con 50 ítems la
    // página seguiría siendo una lista compacta, sin scroll infinito).
    const [expanded,   setExpanded]   = useState(() => new Set());
    const expandedInitRef = useRef(false);

    // Cargar el lote
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res  = await apiFetch(`/api/loans/batches/`);
                const data = await res.json();
                const found = data.find((b) => b.batch_id === batchId);
                if (!found) throw new Error("Lote no encontrado.");
                setBatch(found);
                // Solo mostrar loans activos que pueden devolverse
                const actives = found.loans.filter((l) => l.is_active).map(emptyRow);
                setRows(actives);
                // Expandir solo el primero para descubrir el patrón; el resto
                // queda colapsado en filas compactas.
                if (!expandedInitRef.current && actives.length > 0) {
                    expandedInitRef.current = true;
                    setExpanded(new Set([actives[0].loanId]));
                }
            } catch (err) {
                setFetchError(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [batchId]);

    const updateRow = (loanId, field, value) => {
        setRows((prev) =>
            prev.map((r) => (r.loanId === loanId ? { ...r, [field]: value } : r))
        );
        // Limpiar error del campo cuando el usuario lo modifica
        setErrors((prev) => {
            if (!prev[loanId]) return prev;
            const updated = { ...prev[loanId] };
            delete updated[field];
            return { ...prev, [loanId]: updated };
        });
    };

    const validateRow = (row) => {
        const errs = {};
        if (row.materialType === "consumo") {
            const v = row.leftoverQuantity;
            if (v === "" || v === null) errs.leftoverQuantity = "Requerido";
            else if (!/^\d+$/.test(v))  errs.leftoverQuantity = "Debe ser número entero";
            else if (Number(v) > row.amountLent) errs.leftoverQuantity = `Máx ${row.amountLent}`;
        } else {
            const v = row.returnedQuantity;
            if (v === "" || v === null) errs.returnedQuantity = "Requerido";
            else if (!/^\d+$/.test(v))  errs.returnedQuantity = "Debe ser número entero";
            else if (Number(v) < 1)     errs.returnedQuantity = "Mínimo 1";
            else if (Number(v) > row.amountLent) errs.returnedQuantity = `Máx ${row.amountLent}`;
        }
        return errs;
    };

    const toggleExpand = (loanId) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(loanId)) next.delete(loanId);
            else next.add(loanId);
            return next;
        });
    };

    const expandAll = (list) => setExpanded(new Set(list.map((r) => r.loanId)));
    const collapseAll = () => setExpanded(new Set());

    // Devolver un solo material del lote
    const handleReturnOne = async (row) => {
        const errs = validateRow(row);
        if (Object.keys(errs).length) {
            setErrors((prev) => ({ ...prev, [row.loanId]: errs }));
            return;
        }
        setSubmitting(true);
        try {
            await returnLoan({
                loanId:            row.loanId,
                leftoverQuantity:  row.materialType === "consumo" ? row.leftoverQuantity : undefined,
                returnedQuantity:  row.materialType !== "consumo" ? row.returnedQuantity : undefined,
                observations:      row.observations,
                materialCondition: row.materialCondition,
            });
            setRows((prev) =>
                prev.map((r) => (r.loanId === row.loanId ? { ...r, done: true } : r))
            );
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "Error al devolver", text: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    // Devolver todos los activos de una vez
    const handleReturnAll = async () => {
        const pending = rows.filter((r) => !r.done);
        const allErrs = {};
        let hasErr = false;
        for (const row of pending) {
            const errs = validateRow(row);
            if (Object.keys(errs).length) { allErrs[row.loanId] = errs; hasErr = true; }
        }
        if (hasErr) {
            setErrors(allErrs);
            // Expandir las filas con errores para que se vean al instante.
            setExpanded((prev) => new Set([...prev, ...Object.keys(allErrs).map(Number)]));
            return;
        }

        setSubmitting(true);
        const results = await Promise.allSettled(
            pending.map((row) =>
                returnLoan({
                    loanId:            row.loanId,
                    leftoverQuantity:  row.materialType === "consumo" ? row.leftoverQuantity : undefined,
                    returnedQuantity:  row.materialType !== "consumo" ? row.returnedQuantity : undefined,
                    observations:      row.observations,
                    materialCondition: row.materialCondition,
                })
            )
        );
        setSubmitting(false);

        const failed = results
            .map((r, i) => (r.status === "rejected" ? pending[i].material : null))
            .filter(Boolean);

        if (failed.length === 0) {
            await showAlert({
                icon:      "success",
                iconColor: "var(--color-success)",
                title:     "Devolución completa",
                text:      "Todos los materiales del lote fueron devueltos.",
                timer:     3000,
            });
            navigate("/prestamos");
        } else {
            setRows((prev) =>
                prev.map((r) => {
                    const res = results[pending.findIndex((p) => p.loanId === r.loanId)];
                    return res?.status === "fulfilled" ? { ...r, done: true } : r;
                })
            );
            await showAlert({
                icon:      "warning",
                iconColor: "var(--color-warning)",
                title:     "Devolución parcial",
                text:      `No se pudo devolver: ${failed.join(", ")}. Los demás fueron procesados correctamente.`,
            });
        }
    };

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (fetchError)
        return (
            <div className="h-full flex items-center justify-center p-6">
                <p className="text-error">{fetchError.message}</p>
            </div>
        );

    const pendingRows = rows.filter((r) => !r.done);
    const doneRows    = rows.filter((r) =>  r.done);

    return (
        <div className="h-full text-text-primary flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate("/prestamos")} variant="ghost">
                    <Undo2 size={20} />
                </IconButton>
                <div>
                    <h2 className="text-h2 text-text-primary font-heading">Devolución de Lote</h2>
                    <p className="text-small text-text-muted">
                        Grupo {batch?.apprentice_group} · {batch?.usuario_receptor} ·{" "}
                        {pendingRows.length} material(es) pendiente(s)
                    </p>
                </div>
            </div>

            {/* Barra de progreso + expandir/colapsar */}
            {pendingRows.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-small text-text-muted">
                            {doneRows.length} de {rows.length} devuelto(s)
                        </p>
                        <button
                            type="button"
                            onClick={() => expanded.size === pendingRows.length ? collapseAll() : expandAll(pendingRows)}
                            className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                        >
                            <ChevronsUpDown size={14} />
                            {expanded.size === pendingRows.length ? "Colapsar todo" : "Expandir todo"}
                        </button>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-success transition-all duration-300"
                            style={{ width: rows.length ? `${(doneRows.length / rows.length) * 100}%` : "0%" }}
                        />
                    </div>
                </div>
            )}

            {/* Materiales pendientes (acordeón compacto) */}
            {pendingRows.length > 0 && (
                <div className="flex flex-col gap-2">
                    {pendingRows.map((row) => {
                        const rowErrs = errors[row.loanId] ?? {};
                        const hasErrs = Object.keys(rowErrs).length > 0;
                        const isConsumo = row.materialType === "consumo";
                        const cMeta = CONDITION_META[row.materialCondition];
                        const isOpen = expanded.has(row.loanId);

                        return (
                            <div
                                key={row.loanId}
                                className={`rounded-[var(--radius-xl)] border bg-surface-hover overflow-hidden animate-fade-in transition-colors ${hasErrs ? "border-error/50" : "border-border"}`}
                            >
                                {/* Cabecera compacta */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(row.loanId)}
                                    aria-expanded={isOpen}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/50 transition-colors cursor-pointer"
                                >
                                    <ChevronDown
                                        size={18}
                                        className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-body font-medium text-text-primary truncate">{row.material}</p>
                                        <p className="text-small text-text-muted">
                                            {isConsumo ? "Consumo" : "Devolutivo"} · {row.amountLent} prestado(s)
                                        </p>
                                    </div>
                                    {hasErrs && (
                                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-soft text-error text-small font-medium">
                                            <AlertTriangle size={12} /> Revisar
                                        </span>
                                    )}
                                    <span className={`shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 rounded-full border text-small font-medium ${cMeta.style} ${cMeta.bg}`}>
                                        {row.materialCondition}
                                    </span>
                                </button>

                                {/* Detalle expandible */}
                                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                                    <div className="overflow-hidden">
                                        <div className="px-4 pb-4 flex flex-col gap-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {/* Cantidad */}
                                                {isConsumo ? (
                                                    <Input
                                                        label="Cantidad sobrante"
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder={`Máx ${row.amountLent}`}
                                                        value={row.leftoverQuantity}
                                                        onChange={(e) => updateRow(row.loanId, "leftoverQuantity", e.target.value)}
                                                        error={rowErrs.leftoverQuantity}
                                                        required
                                                    />
                                                ) : (
                                                    <Input
                                                        label="Cantidad devuelta"
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        placeholder={`Prestadas: ${row.amountLent}`}
                                                        value={row.returnedQuantity}
                                                        onChange={(e) => updateRow(row.loanId, "returnedQuantity", e.target.value)}
                                                        error={rowErrs.returnedQuantity}
                                                        required
                                                    />
                                                )}

                                                {/* Observaciones */}
                                                <TextArea
                                                    label="Observaciones"
                                                    placeholder="Estado del material…"
                                                    value={row.observations}
                                                    onChange={(e) => updateRow(row.loanId, "observations", e.target.value)}
                                                    optional
                                                />
                                            </div>

                                            {/* Condición compacta */}
                                            <div className="flex flex-col gap-2">
                                                <p className="text-small font-medium text-text-primary">
                                                    Condición <span className="text-error">*</span>
                                                </p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {CONDITIONS.map((cond) => {
                                                        const m       = CONDITION_META[cond];
                                                        const checked = row.materialCondition === cond;
                                                        return (
                                                            <label
                                                                key={cond}
                                                                className={`flex items-center justify-center cursor-pointer rounded-[var(--radius-lg)] border px-2 py-1.5 text-small font-medium transition-all
                                                                    ${checked ? `${m.style} ${m.bg}` : "border-border text-text-secondary hover:border-text-muted"}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`condition-${row.loanId}`}
                                                                    value={cond}
                                                                    checked={checked}
                                                                    onChange={() => updateRow(row.loanId, "materialCondition", cond)}
                                                                    className="sr-only"
                                                                />
                                                                {m.label}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {row.materialCondition !== "Bueno" && (
                                                    <div className={`flex items-start gap-2 rounded-[var(--radius-lg)] border px-3 py-2 ${cMeta.style} ${cMeta.bg}`}>
                                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                                        <p className="text-small">
                                                            {row.materialCondition === "Mantenimiento"
                                                                ? "El material pasará a Mantenimiento para revisión técnica."
                                                                : "El material será dado de baja permanentemente del inventario."}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => handleReturnOne(row)}
                                                >
                                                    Devolver este
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Materiales ya devueltos en esta sesión */}
            {doneRows.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-small text-text-muted font-medium">Devueltos en esta sesión</p>
                    {doneRows.map((row) => (
                        <div
                            key={row.loanId}
                            className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-success/30 bg-success-soft px-4 py-3"
                        >
                            <CircleCheck size={16} className="text-success shrink-0" />
                            <span className="text-small text-text-primary">{row.material}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Botones de acción globales */}
            {pendingRows.length > 0 && (
                <div className="flex gap-4 justify-center md:justify-end pb-6 md:pb-0">
                    <Button variant="secondary" size="md" onClick={() => navigate("/prestamos")} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button variant="primary" size="md" disabled={submitting} onClick={handleReturnAll}>
                        {submitting ? "Procesando…" : `Devolver todo (${pendingRows.length})`}
                    </Button>
                </div>
            )}

            {pendingRows.length === 0 && doneRows.length > 0 && (
                <div className="flex justify-center">
                    <Button variant="primary" size="md" onClick={() => navigate("/prestamos")}>
                        Volver al listado
                    </Button>
                </div>
            )}
        </div>
    );
}
