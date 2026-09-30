import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button, Modal } from "@/shared";
import { apiFetch } from "@/shared/services/api";

// Aviso post-login si la cuenta no tiene 2FA (Fase 7).
// - Rol con MFA requerido: modal forzoso (sin cerrar) hasta activar.
// - Resto: sugerencia descartable (reaparece al próximo login).
export default function MfaNudgeModal() {
    const navigate = useNavigate();
    const [state, setState] = useState(null); // { required } | null = no mostrar
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await apiFetch("/api/users/me/mfa/status/");
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled && !data.enabled) {
                    setState({ required: data.required });
                }
            } catch {
                // Sin sesión o sin endpoint: no molestar.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!state || dismissed) return null;

    const goActivate = () => navigate("/configuracion");

    return (
        <Modal
            isOpen
            onClose={state.required ? undefined : () => setDismissed(true)}
            title="Protege tu cuenta"
            size="sm"
            showClose={!state.required}
            closeOnBackdrop={!state.required}
        >
            <div className="flex flex-col items-center gap-3 text-center">
                <ShieldCheck size={40} className="text-primary" />
                <p className="text-small text-text-muted">
                    {state.required
                        ? "Tu rol exige verificación en dos pasos. Actívala ahora con tu aplicación autenticadora."
                        : "Activa la verificación en dos pasos para proteger tu cuenta con tu aplicación autenticadora."}
                </p>
                <div className="flex w-full flex-col gap-2">
                    <Button onClick={goActivate}>Activar ahora</Button>
                    {!state.required && (
                        <Button variant="secondary" onClick={() => setDismissed(true)}>
                            Ahora no
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
