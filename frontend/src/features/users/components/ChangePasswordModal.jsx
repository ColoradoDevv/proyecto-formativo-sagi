import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { TailChase } from "ldrs/react";
import { Button, Input, Modal, showAlert } from "@/shared";
import { requestPasswordChangeOtp, confirmPasswordChange } from "../services/userService";

// ── Pasos del flujo ─────────────────────────────────────────────────────────
const STEP_FORM = "form";   // Paso 1: contraseña actual + nueva + confirmación
const STEP_OTP  = "otp";    // Paso 2: código OTP recibido por correo

const EMPTY_FORM = {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
};

const EMPTY_ERRORS = {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    otp: "",
};

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [step, setStep]           = useState(STEP_FORM);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [otpCode, setOtpCode]     = useState("");
    const [errors, setErrors]       = useState(EMPTY_ERRORS);
    const [loading, setLoading] = useState(false);

    // Visibilidad de contraseñas
    const [showCurrent, setShowCurrent]     = useState(false);
    const [showNew, setShowNew]             = useState(false);
    const [showConfirm, setShowConfirm]     = useState(false);

    const reset = () => {
        setStep(STEP_FORM);
        setForm(EMPTY_FORM);
        setOtpCode("");
        setErrors(EMPTY_ERRORS);
        setLoading(false);
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFormChange = (field) => (e) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    // ── Paso 1: solicitar OTP ───────────────────────────────────────────────
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setErrors(EMPTY_ERRORS);
        setLoading(true);

        try {
            await requestPasswordChangeOtp({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
                confirmNewPassword: form.confirmNewPassword,
            });
            setStep(STEP_OTP);
        } catch (err) {
            if (err.fieldErrors) {
                setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            } else {
                await showAlert({
                    icon: "error",
                    iconColor: "var(--color-error)",
                    title: "Error al solicitar el código",
                    text: err.message,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Paso 2: confirmar OTP ───────────────────────────────────────────────
    const handleConfirmOtp = async (e) => {
        e.preventDefault();
        setErrors(EMPTY_ERRORS);
        setLoading(true);

        try {
            await confirmPasswordChange({ otpCode });
            reset();
            onClose();
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Contraseña actualizada",
                text: "Tu contraseña fue cambiada correctamente. Te enviamos un correo de confirmación.",
            });
        } catch (err) {
            if (err.fieldErrors) {
                setErrors((prev) => ({ ...prev, otp: err.fieldErrors.otp_code ?? err.message }));
            } else {
                setErrors((prev) => ({ ...prev, otp: err.message }));
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Render paso 1 ───────────────────────────────────────────────────────
    const renderForm = () => (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <p className="text-small text-text-muted">
                Ingresa tu contraseña actual y elige una nueva. Te enviaremos un código
                de verificación a tu correo para confirmar el cambio.
            </p>

            <Input
                label="Contraseña actual"
                type={showCurrent ? "text" : "password"}
                value={form.currentPassword}
                onChange={handleFormChange("currentPassword")}
                error={errors.currentPassword}
                required
                autoComplete="current-password"
                endAdornment={
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCurrent((v) => !v)}
                        className="cursor-pointer"
                    >
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                }
            />

            <Input
                label="Nueva contraseña"
                type={showNew ? "text" : "password"}
                value={form.newPassword}
                onChange={handleFormChange("newPassword")}
                error={errors.newPassword}
                required
                autoComplete="new-password"
                hint="Mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial."
                endAdornment={
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNew((v) => !v)}
                        className="cursor-pointer"
                    >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                }
            />

            <Input
                label="Confirmar nueva contraseña"
                type={showConfirm ? "text" : "password"}
                value={form.confirmNewPassword}
                onChange={handleFormChange("confirmNewPassword")}
                error={errors.confirmNewPassword}
                required
                autoComplete="new-password"
                endAdornment={
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirm((v) => !v)}
                        className="cursor-pointer"
                    >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                }
            />

            <div className="flex gap-3 justify-end pt-1">
                <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading
                        ? <TailChase size="16" speed="1.75" color="currentColor" />
                        : <><KeyRound size={15} /> Enviar código</>
                    }
                </Button>
            </div>
        </form>
    );

    // ── Render paso 2 ───────────────────────────────────────────────────────
    const renderOtp = () => (
        <form onSubmit={handleConfirmOtp} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 py-2">
                <ShieldCheck size={40} className="text-primary" />
                <p className="text-medium font-medium text-text-primary text-center">
                    Verificación en dos pasos
                </p>
                <p className="text-small text-text-muted text-center max-w-xs">
                    Te enviamos un código de 6 dígitos a tu correo. Ingrésalo para confirmar el cambio.
                </p>
            </div>

            {/* Input OTP estilo código */}
            <Input
                label="Código de verificación"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                error={errors.otp}
                required
                autoComplete="one-time-code"
                placeholder="000000"
                inputClassName="tracking-[0.6em] text-center font-mono text-lg"
                autoFocus
            />

            <div className="flex gap-3 justify-between pt-1">
                {/* Vuelve al paso 1 para corregir los datos y volver a pedir un
                    código — este botón por sí solo no reenvía nada. */}
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setStep(STEP_FORM); setOtpCode(""); setErrors(EMPTY_ERRORS); }}
                    disabled={loading}
                    className="text-small"
                >
                    Corregir datos
                </Button>
                <div className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading || otpCode.length !== 6}>
                        {loading
                            ? <TailChase size="16" speed="1.75" color="currentColor" />
                            : <><ShieldCheck size={15} /> Confirmar</>
                        }
                    </Button>
                </div>
            </div>
        </form>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={step === STEP_FORM ? "Cambiar contraseña" : "Ingresa el código"}
            size="sm"
            closeOnBackdrop={!loading}
        >
            {step === STEP_FORM ? renderForm() : renderOtp()}
        </Modal>
    );
}
