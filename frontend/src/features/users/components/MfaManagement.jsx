import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";
import { Button, Input, showAlert } from "@/shared";
import RecoveryCodesPanel from "@/features/auth/components/RecoveryCodesPanel";
import { apiFetch, throwApiError } from "@/shared/services/api";
import { completeMfaSession } from "@/features/auth/services/mfaService";

async function mfaStatus() {
    const response = await apiFetch("/api/users/me/mfa/status/");
    if (!response.ok) await throwApiError(response);
    return response.json();
}

async function enrollSession(password) {
    const response = await apiFetch("/api/users/me/mfa/enroll/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

async function confirmSession(code, password) {
    const response = await apiFetch("/api/users/me/mfa/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

async function disableMfa(password) {
    const response = await apiFetch("/api/users/me/mfa/disable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
    if (!response.ok) await throwApiError(response);
    return response.json();
}

// Gestión del segundo factor (propia).
// embedded=true: sin encabezado, para incrustar en Mi perfil.
export default function MfaManagement({ embedded = false }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [password, setPassword] = useState("");
    const [qrPng, setQrPng] = useState("");
    const [code, setCode] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState([]);

    const reload = async () => {
        try {
            setLoading(true);
            setStatus(await mfaStatus());
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, []);

    const handleEnroll = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data = await enrollSession(password);
            setQrPng(data.qr_png);
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo iniciar", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data = await confirmSession(code, password);
            setRecoveryCodes(data.recovery_codes ?? []);
            // Confirmar rota la sesión (sesión única): actualizar el token guardado.
            if (data.token) await completeMfaSession(data);
            setQrPng("");
            setCode("");
            await reload();
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Verificación activada", text: "Guarda tus códigos de recuperación." });
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo activar", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await disableMfa(password);
            setPassword("");
            await reload();
            await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Verificación desactivada" });
        } catch (err) {
            await showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo desactivar", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {!embedded && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-h2 text-text-primary font-heading">Seguridad</h2>
                <span className="inline-flex items-center gap-2 text-small text-text-muted">
                    {status?.enabled ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                    {status?.enabled
                        ? `Activa (${status.backup_remaining} respaldos)`
                        : status?.required
                            ? "Requerida para tu rol: actívala"
                            : "Inactiva"}
                </span>
            </div>
            )}

            {!status?.enabled ? (
                <form onSubmit={qrPng ? handleConfirm : handleEnroll} className="flex flex-col gap-4 max-w-md">
                    <p className="text-small text-text-muted">
                        Protege tu cuenta con tu aplicación autenticadora
                        (Google/Microsoft Authenticator, Authy, 1Password...).
                    </p>
                    <Input
                        label="Tu contraseña actual"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    {qrPng && (
                        <>
                            <img src={qrPng} alt="QR para inscribir autenticadora" className="h-44 w-44 rounded-lg bg-white p-2" />
                            <Input
                                label="Código de verificación"
                                type="text"
                                inputMode="numeric"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                required
                                autoComplete="one-time-code"
                                placeholder="000000"
                                inputClassName="tracking-[0.4em] text-center font-mono text-lg"
                            />
                        </>
                    )}
                    {recoveryCodes.length > 0 && (
                        <RecoveryCodesPanel codes={recoveryCodes} />
                    )}
                    <div>
                        <Button type="submit" disabled={saving || !password || (qrPng && code.length !== 6)}>
                            {saving ? "Procesando..." : qrPng ? "Activar" : "Generar QR"}
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleDisable} className="flex flex-col gap-4 max-w-md">
                    <p className="text-small text-text-muted">
                        Al desactivarla, tu cuenta queda solo con contraseña
                        {status?.required ? " (tu rol la exige: se pedirá de nuevo al entrar)" : ""}.
                    </p>
                    <Input
                        label="Tu contraseña actual"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    <div>
                        <Button type="submit" variant="secondary" disabled={saving || !password}>
                            {saving ? "Procesando..." : "Desactivar"}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
