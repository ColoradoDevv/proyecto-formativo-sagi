import { Link } from "react-router-dom";
import { Asterisk, ArrowLeft, MailCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { forgotSchemas } from "../schemas/loginSchemas";
import { requestPasswordReset } from "../services/authService";
import { Button, Input } from "@/shared"

const LOCKOUT_SECONDS = 15 * 60; // 15 minutos, igual que el backend

export default function ForgotForm() {
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [sent, setSent] = useState(false);
    // Segundos restantes de bloqueo; 0 = no bloqueado
    const [lockout, setLockout] = useState(0);
    const timerRef = useRef(null);

    const [formData, setFormData] = useState({
        userEmail: "",
    });

    // Limpia el intervalo al desmontar
    useEffect(() => () => clearInterval(timerRef.current), []);

    const startLockoutTimer = () => {
        setLockout(LOCKOUT_SECONDS);
        timerRef.current = setInterval(() => {
            setLockout((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatLockout = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError("");

        // 1. Validar el formulario con zod
        const result = forgotSchemas.safeParse(formData);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }
        setErrors({});

        // 2. Llamar al backend
        try {
            setLoading(true);
            await requestPasswordReset(formData.userEmail);
            setSent(true);   // exito -> mostramos confirmacion
        } catch (err) {
            if (err.status === 429) {
                startLockoutTimer();
            }
            setServerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Reenvia el enlace al mismo correo (desde la pantalla de confirmacion).
    const handleResend = async () => {
        setServerError("");
        try {
            setLoading(true);
            await requestPasswordReset(formData.userEmail);
        } catch (err) {
            if (err.status === 429) {
                startLockoutTimer();
            }
            setServerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-8 py-10 w-full sm:w-[var(--size-field-md)] animate-slide-up">
            <h2 className="text-center text-h2 font-heading mb-2 text-text-primary">
                Recuperar Contraseña
            </h2>

            {sent ? (
                /* Estado de exito */
                <div className="flex flex-col items-center gap-4 mt-6">
                    <MailCheck size={48} className="text-brand" />
                    <p className="text-center text-small text-text-secondary">
                        Si el correo está registrado, te hemos enviado un enlace
                        para restablecer tu contraseña. Revisa tu bandeja de entrada.
                    </p>

                    {/* Reenviar: vuelve a solicitar el enlace al mismo correo */}
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        disabled={loading || lockout > 0}
                        onClick={handleResend}
                    >
                        {loading
                            ? "Reenviando..."
                            : lockout > 0
                            ? `Bloqueado ${formatLockout(lockout)}`
                            : "Reenviar enlace"}
                    </Button>
                    {serverError && (
                        <p className="text-error text-small text-center">{serverError}</p>
                    )}

                    <Link
                        to="/iniciar-sesion"
                        className="flex items-center gap-1 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        <ArrowLeft size={14} /> Volver a iniciar sesión
                    </Link>
                </div>
            ) : (
                <>
                    <p className="text-center text-small text-text-muted mb-7">
                        Ingresa tu correo y te enviaremos un enlace para restablecerla.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Correo */}
                        <Input
                            type="email"
                            name="userEmail"
                            placeholder="Correo Electrónico"
                            value={formData.userEmail}
                            onChange={handleChange}
                            variant="auth"
                            error={errors.userEmail}
                            endAdornment={<Asterisk size={16} />}
                        />

                        {/* Error del servidor */}
                        {serverError && (
                            <p className="text-error text-small text-center">{serverError}</p>
                        )}

                        {/* Volver al login */}
                        <div className="text-center -mt-1">
                            <Link
                                to="/iniciar-sesion"
                                className="inline-flex items-center gap-1 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                            >
                                <ArrowLeft size={14} /> Volver a iniciar sesión
                            </Link>
                        </div>

                        {/* Botón */}
                        <Button
                            type="submit"
                            disabled={loading || lockout > 0}
                            variant="primary"
                            size="md"
                        >
                            {loading
                                ? "Enviando..."
                                : lockout > 0
                                ? `Bloqueado ${formatLockout(lockout)}`
                                : "Enviar enlace"}
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
}
