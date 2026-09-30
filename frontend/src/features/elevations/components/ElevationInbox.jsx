import { useEffect, useMemo, useState } from "react";
import { Inbox, Send, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import DataTable from "@/shared/components/DataTable";
import LoadingState from "@/shared/components/LoadingState";
import { Button, Input, Modal, showAlert, usePermissions } from "@/shared";
import {
    approveSolicitud,
    cancelSolicitud,
    listSolicitudes,
    rejectSolicitud,
    submitSolicitud,
} from "../services/elevationService";

const STATUS_LABEL = {
    BORRADOR: "Borrador",
    PENDIENTE: "Pendiente",
    APROBADA: "Aprobada",
    RECHAZADA: "Rechazada",
    EXPIRADA: "Expirada",
    CANCELADA: "Cancelada",
    ACTIVA: "Activa",
};

const ACTION_LABEL = {
    CREATE_ROLE: "Crear rol",
    UPDATE_ROLE_PERMS: "Modificar rol",
};

function levelChip(level) {
    const colors = {
        N1: "var(--color-success)",
        N2: "var(--color-warning)",
        N3: "var(--color-error)",
    };
    return (
        <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-small font-medium"
            style={{ color: colors[level] ?? "var(--color-text-muted)", border: `1px solid ${colors[level] ?? "var(--color-border)"}` }}
        >
            {level || "—"}
        </span>
    );
}

export default function ElevationInbox() {
    const { user, isPrimaryAdmin } = usePermissions();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [decision, setDecision] = useState(null); // { mode: "approve"|"reject", solicitud }
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [reason, setReason] = useState("");
    const [keptCodes, setKeptCodes] = useState([]);
    const [saving, setSaving] = useState(false);

    const reload = async () => {
        try {
            setLoading(true);
            setItems(await listSolicitudes());
            setError(null);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, []);

    const mine = useMemo(
        () => items.filter((s) => s.requester_email === user?.email),
        [items, user]
    );
    const toDecide = useMemo(
        () => items.filter((s) => s.status === "PENDIENTE" && s.requester_email !== user?.email),
        [items, user]
    );

    const canDecideHint = (solicitud) =>
        solicitud.status === "PENDIENTE"
        && solicitud.requester_email !== user?.email
        && Boolean(isPrimaryAdmin);

    const openDetail = (solicitud) => setSelected(solicitud);

    const closeDecision = () => {
        setDecision(null);
        setPassword("");
        setTotpCode("");
        setReason("");
        setKeptCodes([]);
    };

    const openApprove = (solicitud) => {
        const codes = snapshotCodes(solicitud);
        setKeptCodes(codes);
        setDecision({ mode: "approve", solicitud });
    };

    const handleSubmit = async (solicitud) => {
        setSaving(true);
        try {
            await submitSolicitud(solicitud.id);
            setSelected(null);
            await reload();
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Solicitud enviada", text: "Quedó pendiente de aprobación." });
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo enviar", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDecide = async () => {
        const { mode, solicitud } = decision;
        setSaving(true);
        try {
            // Step-up: contraseña o código TOTP (Fase 7); el backend acepta cualquiera.
            const stepUp = totpCode.trim()
                ? { password: "", totp_code: totpCode.trim() }
                : { password, totp_code: "" };
            if (mode === "approve") {
                await approveSolicitud(solicitud.id, {
                    ...stepUp,
                    perm_codenames: keptCodes,
                    decision_reason: reason.trim(),
                });
            } else {
                await rejectSolicitud(solicitud.id, { ...stepUp, decision_reason: reason.trim() });
            }
            closeDecision();
            setSelected(null);
            await reload();
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: mode === "approve" ? "Elevación aprobada" : "Solicitud rechazada",
                text: mode === "approve" ? "El rol quedó activo." : "Se avisó al solicitante por correo.",
            });
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo decidir", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (solicitud) => {
        setSaving(true);
        try {
            await cancelSolicitud(solicitud.id);
            setSelected(null);
            await reload();
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo cancelar", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        { accessorKey: "id", header: "N.º" },
        {
            accessorFn: (row) => ACTION_LABEL[row.action] ?? row.action,
            id: "action",
            header: "Tipo",
        },
        {
            accessorFn: (row) => STATUS_LABEL[row.status] ?? row.status,
            id: "status",
            header: "Estado",
            meta: { filterVariant: "select" },
        },
        {
            id: "security_level",
            header: "Nivel",
            cell: ({ row }) => levelChip(row.original.security_level),
        },
        {
            accessorKey: "requester_email",
            header: "Solicitante",
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => (
                <Button variant="ghost" className="text-small" onClick={() => openDetail(row.original)}>
                    Ver
                </Button>
            ),
        },
    ];

    if (loading) {
        return <LoadingState label="Cargando solicitudes…" />;
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <p className="text-small text-text-muted">No se pudieron cargar las solicitudes: {error.message}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-h2 text-text-primary font-heading">Solicitudes de elevación</h2>
                <span className="inline-flex items-center gap-2 text-small text-text-muted">
                    <Inbox size={16} /> {toDecide.length} por decidir · {mine.length} mías
                </span>
            </div>

            <section>
                <h3 className="text-medium font-medium text-text-primary mb-2">Por decidir</h3>
                {toDecide.length === 0 ? (
                    <p className="text-small text-text-muted">Sin solicitudes pendientes para ti.</p>
                ) : (
                    <DataTable data={toDecide} columns={columns} onRowDoubleClick={openDetail} />
                )}
            </section>

            <section>
                <h3 className="text-medium font-medium text-text-primary mb-2">Mis solicitudes</h3>
                {mine.length === 0 ? (
                    <p className="text-small text-text-muted">Aún no has creado solicitudes.</p>
                ) : (
                    <DataTable data={mine} columns={columns} onRowDoubleClick={openDetail} />
                )}
            </section>

            {selected && (
                <SolicitudDetailModal
                    solicitud={selected}
                    isMine={selected.requester_email === user?.email}
                    canDecide={canDecideHint(selected)}
                    saving={saving}
                    onClose={() => setSelected(null)}
                    onSubmit={() => handleSubmit(selected)}
                    onApprove={() => openApprove(selected)}
                    onReject={() => { setDecision({ mode: "reject", solicitud: selected }); }}
                    onCancel={() => handleCancel(selected)}
                />
            )}

            {decision && (
                <DecisionModal
                    mode={decision.mode}
                    solicitud={decision.solicitud}
                    password={password}
                    setPassword={setPassword}
                    totpCode={totpCode}
                    setTotpCode={setTotpCode}
                    reason={reason}
                    setReason={setReason}
                    keptCodes={keptCodes}
                    setKeptCodes={setKeptCodes}
                    saving={saving}
                    onClose={closeDecision}
                    onConfirm={handleDecide}
                />
            )}
        </div>
    );
}

function snapshotCodes(solicitud) {
    return [...((solicitud.payload || {}).snapshot || [])];
}

function SolicitudDetailModal({ solicitud, isMine, canDecide, saving, onClose, onSubmit, onApprove, onReject, onCancel }) {
    const payload = solicitud.payload || {};
    const codes = snapshotCodes(solicitud);
    return (
        <Modal isOpen onClose={onClose} title={`Solicitud #${solicitud.id}`} size="md">
            <div className="flex flex-col gap-3 text-small">
                <div className="flex flex-wrap items-center gap-2">
                    {levelChip(solicitud.security_level)}
                    <span className="text-text-muted">{ACTION_LABEL[solicitud.action] ?? solicitud.action}</span>
                    <span className="text-text-muted">· {STATUS_LABEL[solicitud.status] ?? solicitud.status}</span>
                </div>
                <p className="text-text-secondary">Solicitante: {solicitud.requester_email}</p>
                {solicitud.approver_email && (
                    <p className="text-text-secondary">Decidida por: {solicitud.approver_email}</p>
                )}
                {solicitud.reason && (
                    <p className="text-text-secondary">Motivo: {solicitud.reason}</p>
                )}
                {solicitud.decision_reason && (
                    <p className="text-text-secondary">Decisión: {solicitud.decision_reason}</p>
                )}
                <p className="text-text-muted">Hash: {(solicitud.content_hash || "").slice(0, 12) || "—"}</p>
                {solicitud.expires_at && (
                    <p className="text-text-muted">Expira: {new Date(solicitud.expires_at).toLocaleString()}</p>
                )}
                {codes.length > 0 && (
                    <div>
                        <p className="font-medium text-text-primary mb-1">Permisos propuestos ({codes.length})</p>
                        <ul className="flex flex-col gap-0.5 max-h-40 overflow-auto">
                            {codes.map((code) => (
                                <li key={code} className="font-mono text-text-secondary">{code}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {payload.name && (
                    <p className="text-text-secondary">Rol: {payload.name}{payload.level ? ` (nivel ${payload.level})` : ""}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
                    {isMine && solicitud.status === "BORRADOR" && (
                        <Button onClick={onSubmit} disabled={saving} icon={Send}>Enviar</Button>
                    )}
                    {isMine && solicitud.status === "PENDIENTE" && (
                        <Button variant="secondary" onClick={onCancel} disabled={saving} icon={XCircle}>Cancelar</Button>
                    )}
                    {canDecide && (
                        <>
                            <Button variant="secondary" onClick={onReject} disabled={saving} icon={ShieldX}>Rechazar</Button>
                            <Button onClick={onApprove} disabled={saving} icon={ShieldCheck}>Aprobar</Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function DecisionModal({ mode, solicitud, password, setPassword, totpCode, setTotpCode, reason, setReason, keptCodes, setKeptCodes, saving, onClose, onConfirm }) {
    const codes = snapshotCodes(solicitud);
    const toggleCode = (code) => setKeptCodes((prev) =>
        prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    return (
        <Modal
            isOpen
            onClose={onClose}
            title={mode === "approve" ? `Aprobar solicitud #${solicitud.id}` : `Rechazar solicitud #${solicitud.id}`}
            size="sm"
        >
            <div className="flex flex-col gap-3">
                {mode === "approve" && codes.length > 0 && (
                    <div>
                        <p className="text-small text-text-muted mb-1">
                            Recortes: desmarca permisos para aprobar con menos (no se puede agregar).
                        </p>
                        <ul className="flex flex-col gap-1 max-h-44 overflow-auto">
                            {codes.map((code) => (
                                <li key={code}>
                                    <label className="flex items-center gap-2 text-small cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={keptCodes.includes(code)}
                                            onChange={() => toggleCode(code)}
                                        />
                                        <span className="font-mono">{code}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <Input
                    label={mode === "approve" ? "Motivo de aprobación (opcional)" : "Motivo del rechazo"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required={mode === "reject"}
                />
                <Input
                    label="Tu contraseña (step-up)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                />
                <Input
                    label="O código de tu app (en vez de contraseña)"
                    type="text"
                    inputMode="numeric"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="one-time-code"
                    placeholder="000000"
                />
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Volver</Button>
                    <Button onClick={onConfirm} disabled={saving || (!password && totpCode.length !== 6) || (mode === "reject" && !reason.trim())}>
                        Confirmar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
