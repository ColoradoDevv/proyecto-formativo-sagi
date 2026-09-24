import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Asterisk } from "lucide-react";
import { useState } from "react";
import { loginSchemas } from "../schemas/loginSchemas";
import { login } from "../services/authService";
import { Button, Input, SupportContact } from "@/shared"

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
            await login(formData.userEmail, formData.userPassword);
            navigate(nextPath, { replace: true });   // exito -> destino (o inicio)
        } catch (err) {
            setServerError(err.message);   // ej. "Credenciales inválidas"
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface-hover rounded-[var(--radius-3xl)] shadow-[var(--shadow-elevation-5)] px-6 sm:px-8 py-10 w-full sm:w-[var(--size-field-md)]   select-none animate-slide-up">
            <h2 className="text-center text-h2 font-heading mb-7 text-text-primary select-none">
                Iniciar Sesión
            </h2>

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
        </div>
    );
}
