import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Asterisk, ArrowLeft, CircleCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { resetSchemas } from "../schemas/loginSchemas";
import { resetPassword } from "../services/authService";
import { Button, Input } from "@/shared";

const LOCKOUT_SECONDS = 15 * 60; // 15 minutos, igual que el backend

export default function ResetPasswordForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [done, setDone] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    // Segundos restantes de bloqueo; 0 = no bloqueado
    const [lockout, setLockout] = useState(0);
    const timerRef = useRef(null);

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
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
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError("");

        const result = resetSchemas.safeParse(formData);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }
        setErrors({});

        try {
            setLoading(true);
            await resetPassword(token, formData.password, formData.confirmPassword);
            setDone(true);
        } catch (err) {
            if (err.status === 429) {
                startLockoutTimer();
            }
            setServerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const passwordToggle = (
        <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-text-muted hover:text-text-secondary transition-colors"
        >
            {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
    );

    return (
        <div className="bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-8 py-10 w-full sm:w-[var(--size-field-md)] animate-slide-up">
            <h2 className="text-center text-h2 font-heading mb-2 text-text-primary">
                Nueva Contraseña
            </h2>

            {/* Sin token en la URL: enlace invalido */}
            {!token ? (
                <div className="flex flex-col items-center gap-4 mt-6">
                    <p className="text-center text-small text-text-secondary">
                        El enlace no es válido o está incompleto. Solicita uno nuevo desde
                        "¿Olvidó su contraseña?".
                    </p>
                    <Link
                        to="/forgot-password"
                        className="flex items-center gap-1 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        <ArrowLeft size={14} /> Solicitar nuevo enlace
                    </Link>
                </div>
            ) : done ? (
                /* Exito */
                <div className="flex flex-col items-center gap-4 mt-6">
                    <CircleCheck size={48} className="text-brand" />
                    <p className="text-center text-small text-text-secondary">
                        Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
                    </p>
                    <Button variant="primary" size="md" onClick={() => navigate("/iniciar-sesion")}>
                        Ir a iniciar sesión
                    </Button>
                </div>
            ) : (
                <>
                    <p className="text-center text-small text-text-muted mb-7">
                        Ingresa tu nueva contraseña. Debe tener mínimo 10 caracteres con
                        mayúscula, minúscula, número y carácter especial.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            placeholder="Nueva contraseña"
                            value={formData.password}
                            onChange={handleChange}
                            variant="auth"
                            error={errors.password}
                            endAdornment={passwordToggle}
                        />

                        <Input
                            type={showPassword ? "text" : "password"}
                            name="confirmPassword"
                            placeholder="Confirmar contraseña"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            variant="auth"
                            error={errors.confirmPassword}
                            endAdornment={<Asterisk size={16} />}
                        />

                        {serverError && (
                            <p className="text-error text-small text-center">{serverError}</p>
                        )}

                        <div className="text-center -mt-1">
                            <Link
                                to="/iniciar-sesion"
                                className="inline-flex items-center gap-1 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                            >
                                <ArrowLeft size={14} /> Volver a iniciar sesión
                            </Link>
                        </div>

                        <Button type="submit" disabled={loading || lockout > 0} variant="primary" size="md">
                            {loading
                                ? "Guardando..."
                                : lockout > 0
                                ? `Bloqueado ${formatLockout(lockout)}`
                                : "Restablecer contraseña"}
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
}
