import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Undo2, Eye, CloudAlert, Package } from "lucide-react";
import { Button, IconButton, Input, TextArea, EditCard, usePermissions } from "@/shared";
import LoanStateBadge from "../LoanStateBadge";
import { getLoanBatches } from "../../services/loanService";
import { TailChase } from "ldrs/react";

// Detalle de un LOTE de préstamos: encabezado vistoso con estado,
// secciones organizadas (personas, préstamo, materiales) y acceso al
// detalle individual y a la devolución.
export default function BatchDetailView() {
    const navigate = useNavigate();
    const { batchId } = useParams();
    const { isSuper, can } = usePermissions();
    const canReturn = isSuper || can("create_return");

    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getLoanBatches()
            .then((batches) => {
                if (cancelled) return;
                const found = (batches ?? []).find((b) => String(b.batch_id) === String(batchId));
                if (!found) throw new Error("Lote no encontrado.");
                setBatch(found);
            })
            .catch((err) => {
                if (!cancelled) setError(err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [batchId]);

    if (loading)
        return (
            <div className="h-full flex items-center justify-center">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (error)
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-3 bg-text-secondary border border-text-secondary text-text-inverse rounded-lg px-6 py-4 max-w-md">
                    <span className="text-h1"><CloudAlert /></span>
                    <div>
                        <p className="font-heading">Error al cargar el lote</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    if (!batch) return null;

    const materialCount = batch.loans?.length ?? 0;

    return (
        <div className="h-full text-text-primary flex flex-col gap-4">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={18} />
                </IconButton>
                <div className="flex-1 min-w-0">
                    <h2 className="text-h2 text-text-primary font-heading truncate">
                        Préstamo para {batch.usuario_receptor}
                    </h2>
                    <p className="text-small text-text-muted">
                        Lote de {materialCount} material(es) · Salida {batch.loan_date ?? "—"}
                    </p>
                </div>
                <LoanStateBadge state={batch.state} />
            </div>

            {/* Personas */}
            <EditCard title="Personas" cols={1}>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 min-w-0">
                    <Input label="Responsable" value={batch.usuario_responsable ?? ""} disabled readOnly />
                    <Input label="Receptor" value={batch.usuario_receptor ?? ""} disabled readOnly />
                    <Input label="Documento del solicitante" value={batch.receptor_document ?? ""} disabled readOnly />
                </div>
            </EditCard>

            {/* Préstamo */}
            <EditCard title="Información del Préstamo" cols={1}>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 min-w-0">
                    <Input label="Grupo / Ficha" value={batch.apprentice_group || "—"} disabled readOnly />
                    <Input label="Fecha de salida" value={batch.loan_date ?? ""} disabled readOnly />
                    <Input label="Fecha de devolución" value={batch.return_date ?? ""} disabled readOnly />
                    <div className="sm:col-span-3">
                        <TextArea label="Justificación de Uso" value={batch.justification_use ?? ""} disabled readOnly />
                    </div>
                </div>
            </EditCard>

            {/* Materiales */}
            <EditCard title={`Materiales (${materialCount})`} cols={1}>
                <ul className="flex flex-col rounded-[var(--radius-md)] border border-border overflow-hidden divide-y divide-border">
                    {(batch.loans ?? []).map((loan) => (
                        <li
                            key={loan.id_loan}
                            className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-hover hover:bg-surface-muted transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="bg-brand-soft text-brand rounded-xl w-9 h-9 flex items-center justify-center shrink-0">
                                    <Package size={16} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-medium text-text-primary truncate font-medium">
                                        {loan.material}
                                    </p>
                                    <p className="text-small text-text-muted truncate">
                                        {loan.material_type === "devolutivo" ? "Devolutivo" : "Consumo"} · {loan.amount_lent} und.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <LoanStateBadge state={loan.state} />
                                <IconButton
                                    onClick={() => navigate(`/prestamos/visualizar/${loan.id_loan}`)}
                                    variant="ghost"
                                    hitSize={32}
                                    iconSize={16}
                                    ariaLabel="Ver detalle del préstamo"
                                >
                                    <Eye size={16} />
                                </IconButton>
                            </div>
                        </li>
                    ))}
                </ul>
            </EditCard>

            <div className="flex gap-4 justify-center md:justify-end">
                <Button variant="secondary" size="md" onClick={() => navigate("/prestamos")}>
                    Volver al listado
                </Button>
                {batch.is_active && canReturn && (
                    <Button variant="primary" size="md" onClick={() => navigate(`/prestamos/lote/${batch.batch_id}/devolver`)}>
                        Devolver materiales
                    </Button>
                )}
            </div>

        </div>
    );
}
