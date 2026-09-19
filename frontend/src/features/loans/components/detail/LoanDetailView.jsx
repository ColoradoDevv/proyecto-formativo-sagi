import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Undo2, CloudAlert, Clock, CheckCircle2 } from "lucide-react";
import { Button, IconButton, Input, TextArea, EditCard } from "@/shared";
import useLoan from "../../hooks/useLoan";
import ReturnLoanModal from "../ReturnLoanModal";
import LoanStateBadge from "../LoanStateBadge";
import { TailChase } from "ldrs/react";

export default function LoanDetailView() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { loan, loading, error } = useLoan(id);
    const [returnOpen, setReturnOpen] = useState(false);

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
                        <p className="font-heading">Error al cargar el préstamo</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );

    if (!loan) return null;

    const isPending = loan.state === "Pendiente";

    // Helpers de trazabilidad
    const firmaResponsable = loan.firma_responsable;
    const firmaReceptor    = loan.firma_receptor;

    const formatDate = (iso) => {
        if (!iso) return null;
        return new Date(iso).toLocaleString("es-CO", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    };

    const formatAudit = (firma) => {
        if (!firma) return null;
        const parts = [];
        if (firma.ip) parts.push(`IP: ${firma.ip}`);
        if (firma.user_agent) parts.push(firma.user_agent);
        return parts.length ? parts.join(" · ") : null;
    };

    return (
        <div className="h-full p-3 sm:p-4 text-text-primary flex flex-col gap-3">

            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <IconButton onClick={() => navigate(-1)} variant="ghost">
                    <Undo2 size={18}/>
                </IconButton>
                <div className="flex-1">
                    <h2 className="text-primary">Visualizar Préstamo</h2>
                </div>
                <LoanStateBadge state={loan.state} />
            </div>

            {/* Banner de pendiente: estado de firmas */}
            {isPending && (
                <div className="flex flex-col gap-2 rounded-[var(--radius-xl)] border border-warning bg-warning-soft px-4 py-3">
                    <div className="flex items-center gap-2 text-warning font-medium text-small">
                        <Clock size={16} />
                        <span>Pendiente de firma — el préstamo se activará cuando ambas partes confirmen.</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {/* Firma responsable */}
                        <div className="flex items-start gap-2 text-small">
                            {firmaResponsable
                                ? <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                                : <Clock        size={15} className="text-warning mt-0.5 shrink-0" />
                            }
                            <div>
                                <p className="text-text-primary font-medium">Responsable</p>
                                {firmaResponsable
                                    ? (
                                        <>
                                            <p className="text-text-secondary">{firmaResponsable.usuario} — {formatDate(firmaResponsable.fecha)}</p>
                                            {formatAudit(firmaResponsable) && (
                                                <p className="text-text-muted text-xs break-all">{formatAudit(firmaResponsable)}</p>
                                            )}
                                        </>
                                    )
                                    : <p className="text-text-muted">Pendiente de firma</p>
                                }
                            </div>
                        </div>
                        {/* Firma receptor */}
                        <div className="flex items-start gap-2 text-small">
                            {firmaReceptor
                                ? <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                                : <Clock        size={15} className="text-warning mt-0.5 shrink-0" />
                            }
                            <div>
                                <p className="text-text-primary font-medium">Receptor</p>
                                {firmaReceptor
                                    ? (
                                        <>
                                            <p className="text-text-secondary">{firmaReceptor.usuario} — {formatDate(firmaReceptor.fecha)}</p>
                                            {formatAudit(firmaReceptor) && (
                                                <p className="text-text-muted text-xs break-all">{formatAudit(firmaReceptor)}</p>
                                            )}
                                        </>
                                    )
                                    : <p className="text-text-muted">Pendiente de firma</p>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trazabilidad de firma para préstamos ya activos */}
            {!isPending && (firmaResponsable || firmaReceptor) && (
                <div className="flex flex-col gap-2 rounded-[var(--radius-xl)] border border-border bg-surface-hover px-4 py-3 animate-fade-in">
                    <p className="text-small font-medium text-text-primary">Trazabilidad de firma</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {firmaResponsable && (
                            <div className="flex items-start gap-2 text-small">
                                <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-text-muted">Responsable</p>
                                    <p className="text-text-secondary">{firmaResponsable.usuario}</p>
                                    <p className="text-text-muted">{formatDate(firmaResponsable.fecha)}</p>
                                    {formatAudit(firmaResponsable) && (
                                        <p className="text-text-muted text-xs break-all">{formatAudit(firmaResponsable)}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {firmaReceptor && (
                            <div className="flex items-start gap-2 text-small">
                                <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-text-muted">Receptor</p>
                                    <p className="text-text-secondary">{firmaReceptor.usuario}</p>
                                    <p className="text-text-muted">{formatDate(firmaReceptor.fecha)}</p>
                                    {formatAudit(firmaReceptor) && (
                                        <p className="text-text-muted text-xs break-all">{formatAudit(firmaReceptor)}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">

                {/* Información del Préstamo */}
                <EditCard title="Información del Préstamo" cols={1}>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

                        {/* Campos del prestamo */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
                            <Input label="Usuario Responsable" value={loan.usuario_responsable ?? ""} disabled readOnly />
                            <Input label="Usuario Receptor" value={loan.usuario_receptor ?? ""} disabled readOnly />
                            <Input label="Material" value={loan.material ?? ""} disabled readOnly />
                            <Input
                                label="Tipo de material"
                                value={loan.material_type === "devolutivo" ? "Material devolutivo" : "Material de consumo"}
                                disabled
                                readOnly
                            />
                            <Input label="Cantidad" value={loan.amount_lent ?? ""} disabled readOnly />
                            <Input label="Grupo" value={loan.apprentice_group ?? ""} disabled readOnly />
                            <Input label="Fecha de salida" value={loan.loan_date ?? ""} disabled readOnly />
                            <Input label="Fecha Devolución" value={loan.return_date ?? ""} disabled readOnly />
                            <div className="sm:col-span-2">
                                <TextArea label="Justificación de Uso" value={loan.justification_use ?? ""} disabled readOnly />
                            </div>
                        </div>

                    </div>
                </EditCard>

                <div className="flex gap-4 justify-center md:justify-end">
                    <Button variant="secondary" size="md" onClick={() => navigate("/prestamos")}>
                        Volver al listado
                    </Button>
                    {loan.is_active && (
                        <Button variant="secondary" size="md" onClick={() => setReturnOpen(true)}>
                            Devolver material
                        </Button>
                    )}
                    <Button variant="primary" size="md" onClick={() => navigate(`/prestamos/editar/${loan.id_loan}`)}>
                        Editar
                    </Button>
                </div>

            </div>

            <ReturnLoanModal
                isOpen={returnOpen}
                onClose={() => setReturnOpen(false)}
                loan={loan}
                onReturned={() => navigate("/prestamos")}
            />

        </div>
    );
}
