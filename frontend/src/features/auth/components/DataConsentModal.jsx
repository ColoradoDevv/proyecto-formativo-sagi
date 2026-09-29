import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut } from "lucide-react";
import { TailChase } from "ldrs/react";
import { Button, DataConsentCheckbox, Modal, cancelAlert } from "@/shared";
import { getStoredUser, isAuthenticated, updateStoredUser } from "@/shared/services/api";
import { acceptDataConsent, logout } from "../services/authService";

/**
 * Modal global de autorización de tratamiento de datos personales
 * (Ley 1581 de 2012).
 *
 * Se monta en App.jsx y bloquea toda interacción hasta que el usuario
 * acepta. Regulariza cuentas creadas antes de exigir el consentimiento
 * (data_consent=false): al aceptar se registra con fecha en el backend.
 */
export default function DataConsentModal() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [checked, setChecked] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const syncOpenState = useCallback(() => {
        const user = getStoredUser();
        const needs = Boolean(isAuthenticated() && user && user.data_consent !== true);
        setOpen(needs);
        if (!needs) {
            setChecked(false);
            setError("");
        }
    }, []);

    useEffect(() => {
        syncOpenState();
        window.addEventListener("sia:session-updated", syncOpenState);
        return () => window.removeEventListener("sia:session-updated", syncOpenState);
    }, [syncOpenState]);

    const handleLogout = async () => {
        const result = await cancelAlert({
            title: "¿Cerrar sesión?",
            text: "Tendrás que iniciar sesión de nuevo para autorizar el tratamiento de tus datos.",
            confirmText: "Sí, cerrar sesión",
            cancelText: "Seguir aquí",
        });
        if (!result.isConfirmed) return;

        setLoggingOut(true);
        await logout();
        setOpen(false);
        navigate("/iniciar-sesion", { replace: true });
    };

    const handleAccept = async () => {
        if (!checked) {
            setError("Debes marcar la casilla de autorización para continuar.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await acceptDataConsent();
            updateStoredUser({ data_consent: true });
            setOpen(false);
        } catch (err) {
            setError(err.message || "No se pudo registrar la autorización.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={() => {}}
            title="Tratamiento de datos personales"
            showClose={false}
            closeOnBackdrop={false}
            footer={
                <div className="flex flex-1 items-center justify-center gap-3 flex-wrap">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleLogout}
                        disabled={loading || loggingOut}
                        className="whitespace-nowrap"
                    >
                        {loggingOut ? (
                            <TailChase size="16" speed="1.75" color="var(--semantic-text-primary)" />
                        ) : (
                            <><LogOut size={15} /> Cerrar sesión</>
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleAccept}
                        disabled={loading || loggingOut}
                        className="whitespace-nowrap"
                    >
                        {loading ? (
                            <TailChase size="16" speed="1.75" color="var(--semantic-text-inverse)" />
                        ) : (
                            <><ShieldCheck size={15} /> Aceptar</>
                        )}
                    </Button>
                </div>
            }
        >
            <p className="text-small text-text-secondary">
                Para usar el sistema debes autorizar el tratamiento de tus datos personales.
                Esta autorización queda registrada con fecha y hora.
            </p>
            <DataConsentCheckbox
                id="data-consent-pending"
                name="data-consent-pending"
                variant="titular"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                error={error}
            />
        </Modal>
    );
}
