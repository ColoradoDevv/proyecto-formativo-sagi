import { useEffect, useState } from "react";
import { LifeBuoy, Mail, Pencil } from "lucide-react";
import EditCard from "./EditCard";
import Button from "./Button";
import { IconButton } from "./IconButton";
import Input from "./Input";
import Modal from "./Modal";
import showAlert from "../alerts/Alert";
import { usePermissions } from "../hooks/usePermissions";
import { getSupportEmail, updateSupportEmail } from "../services/supportService";

// Contacto con soporte para todos + edición del correo solo para superusuario.
// `compact`: versión de una línea para el login (sin sesión).
export default function SupportContact({ compact = false }) {
    const { isSuper } = usePermissions();
    const [email, setEmail] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        getSupportEmail(controller.signal)
            .then(setEmail)
            .catch(() => setEmail(""));
        return () => controller.abort();
    }, []);

    const openEdit = () => {
        setDraft(email);
        setDraftError("");
        setModalOpen(true);
    };

    const handleSave = async () => {
        const value = draft.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            setDraftError("Ingresa un correo electrónico válido.");
            return;
        }
        setSaving(true);
        try {
            const saved = await updateSupportEmail(value);
            setEmail(saved);
            setModalOpen(false);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Correo de soporte actualizado",
                text: "El nuevo correo aplica para todos los usuarios.",
            });
        } catch (err) {
            setDraftError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (compact) {
        // En el login (sin sesión) solo se muestra el contacto — el cambio
        // de correo vive únicamente en Mi perfil.
        return (
            <div className="flex flex-col items-center gap-2">
                {email ? (
                    <a
                        href={`mailto:${email}`}
                        className="inline-flex items-center gap-2 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        <LifeBuoy size={14} />
                        ¿Necesitas ayuda? Contactar soporte
                    </a>
                ) : null}
            </div>
        );
    }

    return (
        <EditCard title="Soporte" cols={1}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className="text-medium">Contacto de soporte</p>
                    <p className="text-small text-text-muted">
                        {email || "Aún no hay un correo de soporte configurado."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {email && (
                        <a href={`mailto:${email}`}>
                            <Button variant="secondary" size="md" icon={Mail}>
                                Contactar soporte
                            </Button>
                        </a>
                    )}
                    {isSuper && (
                        <IconButton
                            variant="ghost"
                            onClick={openEdit}
                            ariaLabel={email ? "Cambiar correo de soporte" : "Configurar correo de soporte"}
                        >
                            <Pencil size={16} />
                        </IconButton>
                    )}
                </div>
            </div>
            <SupportEmailModal
                open={modalOpen}
                draft={draft}
                error={draftError}
                saving={saving}
                onChange={(value) => {
                    setDraft(value);
                    setDraftError("");
                }}
                onClose={() => !saving && setModalOpen(false)}
                onSave={handleSave}
            />
        </EditCard>
    );
}

function SupportEmailModal({ open, draft, error, saving, onChange, onClose, onSave }) {
    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Correo de soporte"
            variant="solid"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={onSave} disabled={saving}>
                        {saving ? "Guardando..." : "Guardar"}
                    </Button>
                </>
            }
        >
            <p className="text-small text-text-muted">
                Este correo lo verán todos los usuarios en el inicio de sesión y en su perfil.
            </p>
            <Input
                label="Correo de soporte"
                name="supportEmail"
                type="email"
                placeholder="soporte@ejemplo.com"
                value={draft}
                onChange={(e) => onChange(e.target.value)}
                error={error}
                required
            />
        </Modal>
    );
}
