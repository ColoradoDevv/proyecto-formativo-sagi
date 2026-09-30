import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Asterisk, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { loginSchemas } from "../schemas/loginSchemas";
import { login } from "../services/authService";
import { completeMfaSession, confirmMfa, enrollMfa, verifyMfa } from "../services/mfaService";
import { Button, Input, SupportContact } from "@/shared"
import RecoveryCodesPanel from "./RecoveryCodesPanel";

// Pasos del login: credenciales → (código MFA | inscripción MFA | códigos de respaldo)
const STEP_CREDENTIALS = "credentials";
const STEP_CODE = "code";
const STEP_ENROLL = "enroll";
const STEP_RECOVERY_CODES = "recovery-codes";

export default function LoginForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Si llegamos desde una redirección (p.ej. enlace de firma), volvemos allí tras el login.
    const nextPath = searchParams.get("next") || "/";
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");

    const [formData, setFormData] = useState({
        userEmail: "",
        userPassword: "",
    });

    // Fase 7: segundo factor.
    const [step, setStep] = useState(STEP_CREDENTIALS);
    const [mfaToken, setMfaToken] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [useRecovery, setUseRecovery] = useState(false);
    const [qrPng, setQrPng] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState([]);

    // Pasos altos del MFA (QR, códigos): pedir a AuthLayout que oculte el
    // encabezado SAGI para no desbordar la tarjeta; se restaura al salir.
    // Solo códigos además ensancha (wide) para respirar sin tocar bordes.
    useEffect(() => {
        const compact = step === STEP_ENROLL || step === STEP_RECOVERY_CODES;
        const wide = step === STEP_RECOVERY_CODES;
        window.dispatchEvent(new CustomEvent("sagi:auth-compact", { detail: { compact, wide } }));
        return () => {
            window.dispatchEvent(new CustomEvent("sagi:auth-compact", { detail: { compact: false, wide: false } }));
        };
    }, [step]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError("");

        // 1. Validar el formulario con zod
        const result = loginSchemas.safeParse(formData);
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
            const result = await login(formData.userEmail, formData.userPassword);
            if (result.mfaRequired) {
                // Segundo factor: guardar el temporal y pedir QR o código.
                setMfaToken(result.mfaToken);
                if (result.enrollRequired) {
                    const enroll = await enrollMfa(result.mfaToken);
                    setQrPng(enroll.qr_png);
                    setStep(STEP_ENROLL);
                } else {
                    setStep(STEP_CODE);
                }
                return;
            }
            navigate(nextPath, { replace: true });   // exito -> destino (o inicio)
        } catch (err) {
            setServerError(err.message);   // ej. "Credenciales inválidas"
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setServerError("");
        try {
            setLoading(true);
            const data = await verifyMfa(mfaToken, useRecovery
                ? { recovery_code: mfaCode }
                : { code: mfaCode });
            await completeMfaSession(data);
            navigate(nextPath, { replace: true });
        } catch (err) {
            setServerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmEnroll = async (e) => {
        e.preventDefault();
        setServerError("");
        try {
            setLoading(true);
            const data = await confirmMfa(mfaToken, mfaCode);
            setRecoveryCodes(data.recovery_codes ?? []);
            await completeMfaSession(data);
            setStep(STEP_RECOVERY_CODES);
        } catch (err) {
            setServerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const backToCredentials = () => {
        setStep(STEP_CREDENTIALS);
        setMfaToken("");
        setMfaCode("");
        setUseRecovery(false);
        setQrPng("");
        setRecoveryCodes([]);
        setServerError("");
    };

    const isWideStep = step === STEP_RECOVERY_CODES;

    return (
        <div className={`bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-8 py-10 w-full ${isWideStep ? "" : "sm:w-[var(--size-field-md)]"}   select-none animate-slide-up`}>
            <h2 className="text-center text-h2 font-heading mb-7 text-text-primary select-none">
                {step === STEP_CREDENTIALS ? "Iniciar Sesión" : "Verificación en dos pasos"}
            </h2>

            {step === STEP_CREDENTIALS && (
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

                {/* Contraseña */}
                <Input
                    type={showPassword ? "text" : "password"}
                    name="userPassword"
                    placeholder="Contraseña"
                    value={formData.userPassword}
                    onChange={handleChange}
                    variant="auth"
                    error={errors.userPassword}
                    endAdornment={
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="text-text-muted hover:text-text-secondary transition-colors"
                        >
                            {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                    }
                />

                {/* Error del servidor */}
                {serverError && (
                    <p className="text-error text-small text-center break-words">{serverError}</p>
                )}

                {/* Olvidó contraseña */}
                <div className="text-center -mt-1">
                    <Link to="/forgot-password" className="text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors">
                        ¿Olvidó su contraseña?
                    </Link>
                </div>

                {/* Botón */}
                <Button
                    type="submit"
                    disabled={loading}
                    variant="primary"
                    size="md"
                >
                    {loading ? "Entrando..." : "Entrar"}
                </Button>

                {/* Aviso de privacidad (Ley 1581 de 2012) */}
                <p className="text-center text-small text-text-muted">
                    Al ingresar aceptas el{" "}
                    <Link to="/aviso-privacidad" className="underline underline-offset-2 hover:text-text-secondary transition-colors">
                        aviso de privacidad
                    </Link>
                    .
                </p>

                {/* Contacto con soporte (visible sin sesión) */}
                <SupportContact compact />
            </form>
            )}

            {step === STEP_CODE && (
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2">
                    <ShieldCheck size={40} className="text-primary" />
                    <p className="text-small text-text-muted text-center">
                        {useRecovery
                            ? "Ingresa uno de tus códigos de recuperación (un solo uso)."
                            : "Abre tu aplicación autenticadora e ingresa el código de 6 dígitos."}
                    </p>
                </div>

                <Input
                    label={useRecovery ? "Código de recuperación" : "Código de verificación"}
                    type="text"
                    inputMode={useRecovery ? "text" : "numeric"}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(useRecovery
                        ? e.target.value.toUpperCase()
                        : e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
                    inputClassName="tracking-[0.4em] text-center font-mono text-lg"
                />

                {serverError && (
                    <p className="text-error text-small text-center break-words">{serverError}</p>
                )}

                <Button type="submit" disabled={loading} variant="primary" size="md">
                    {loading ? "Verificando..." : "Verificar"}
                </Button>

                <div className="flex flex-col gap-1 text-center">
                    <button
                        type="button"
                        onClick={() => { setUseRecovery((v) => !v); setMfaCode(""); setServerError(""); }}
                        className="text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        {useRecovery ? "Usar código de la aplicación" : "Usar código de recuperación"}
                    </button>
                    <button
                        type="button"
                        onClick={backToCredentials}
                        className="text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        Volver al inicio de sesión
                    </button>
                </div>
            </form>
            )}

            {step === STEP_ENROLL && (
            <form onSubmit={handleConfirmEnroll} className="flex flex-col gap-4">
                <p className="text-small text-text-muted text-center">
                    Tu cuenta exige verificación en dos pasos. Escanea el QR con tu
                    aplicación autenticadora y digita el código actual para activar.
                </p>

                {qrPng && (
                    <img src={qrPng} alt="QR para inscribir autenticadora" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
                )}

                <Input
                    label="Código de verificación"
                    type="text"
                    inputMode="numeric"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder="000000"
                    inputClassName="tracking-[0.4em] text-center font-mono text-lg"
                />

                {serverError && (
                    <p className="text-error text-small text-center break-words">{serverError}</p>
                )}

                <Button type="submit" disabled={loading} variant="primary" size="md">
                    {loading ? "Activando..." : "Activar y entrar"}
                </Button>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={backToCredentials}
                        className="text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        Volver al inicio de sesión
                    </button>
                </div>
            </form>
            )}

            {step === STEP_RECOVERY_CODES && (
            <div className="flex flex-col gap-4">
                <RecoveryCodesPanel codes={recoveryCodes} />

                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => navigate(nextPath, { replace: true })}
                >
                    Ya los guardé, entrar
                </Button>
            </div>
            )}
        </div>
    );
}
