import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, LogOut, ShieldAlert } from "lucide-react";
import { TailChase } from "ldrs/react";
import { Button, Input, Modal, cancelAlert, showAlert } from "@/shared";
import { getStoredUser, isAuthenticated } from "@/shared/services/api";
import { changePasswordFirstLogin, logout } from "../services/authService";

const EMPTY_FORM = {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
};

const EMPTY_ERRORS = {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
};

/**
 * Modal global de cambio obligatorio de contraseña en el primer inicio de sesión.
 *
 * Se monta en App.jsx y bloquea toda interacción con el sistema hasta que
 * el usuario establezca una contraseña personalizada.
 */
export default function MandatoryPasswordChangeModal() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState(EMPTY_ERRORS);
    const [loading, setLoading] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const syncOpenState = useCallback(() => {
        const user = getStoredUser();
        setOpen(Boolean(isAuthenticated() && user?.must_change_password));
    }, []);

    useEffect(() => {
        syncOpenState();
        window.addEventListener("sia:session-updated", syncOpenState);
        return () => window.removeEventListener("sia:session-updated", syncOpenState);
    }, [syncOpenState]);

    const handleChange = (field) => (e) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    // Escotilla de salida: sin esto, un usuario que no recuerda su contraseña
    // temporal (o simplemente quiere ceder el equipo) queda atrapado en este
    // modal sin forma de volver al login.
    const handleLogout = async () => {
        const result = await cancelAlert({
            title: "¿Cerrar sesión?",
            text: "Tendrás que iniciar sesión de nuevo con tu contraseña temporal.",
            confirmText: "Sí, cerrar sesión",
            cancelText: "Seguir aquí",
        });
        if (!result.isConfirmed) return;

        setLoggingOut(true);
        await logout();
        setOpen(false);
        navigate("/iniciar-sesion", { replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors(EMPTY_ERRORS);
        setLoading(true);

        try {
            await changePasswordFirstLogin({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
                confirmNewPassword: form.confirmNewPassword,
            });

            setForm(EMPTY_FORM);
            setOpen(false);

            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Contraseña actualizada",
                text: "Tu contraseña fue cambiada correctamente. Ya puedes usar el sistema.",
            });

            // Recargar permisos ahora que el usuario puede operar con normalidad.
            try {
                const { getToken, setStoredPermissions } = await import("@/shared/services/api");
                const token = getToken();
                if (token) {
                    const permRes = await fetch("/api/permissions/permissions/my_permission_codes/", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (permRes.ok) {
                        const permData = await permRes.json();
                        setStoredPermissions(permData.permissions ?? []);
                    }
                }
            } catch {
                // El backend seguirá validando permisos en cada petición.
            }
        } catch (err) {
            if (err.fieldErrors) {
                setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
            } else if (!err.silent) {
                await showAlert({
                    icon: "error",
                    iconColor: "var(--color-error)",
                    title: "Error al cambiar la contraseña",
                    text: err.message,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const user = getStoredUser();

    return (
        <Modal
            isOpen={open}
            onClose={() => {}}
            title="Cambio de contraseña obligatorio"
            variant="solid"
            size="sm"
            showClose={false}
            closeOnBackdrop={false}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2 py-1 text-center">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-warning-subtle text-warning-default">
                        <ShieldAlert size={28} />
                    </div>
                    <p className="text-body text-text-primary font-medium">
                        {user?.first_name ? `Hola, ${user.first_name}` : "Bienvenido"}
                    </p>
                    <p className="text-small text-text-secondary max-w-xs">
                        Por seguridad, debes cambiar tu contraseña temporal antes de
                        continuar. No podrás usar el sistema hasta completar este paso.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Contraseña actual (temporal)"
                        type={showCurrent ? "text" : "password"}
                        value={form.currentPassword}
                        onChange={handleChange("currentPassword")}
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
                        onChange={handleChange("newPassword")}
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
                        onChange={handleChange("confirmNewPassword")}
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

                    <Button type="submit" disabled={loading || loggingOut} className="w-full">
                        {loading
                            ? <TailChase size="16" speed="1.75" color="currentColor" />
                            : <><KeyRound size={15} /> Cambiar contraseña y continuar</>
                        }
                    </Button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loading || loggingOut}
                        className="flex items-center justify-center gap-1.5 text-small text-text-muted hover:text-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <LogOut size={14} />
                        {loggingOut ? "Cerrando sesión..." : "Cerrar sesión y volver al inicio"}
                    </button>
                </form>
            </div>
        </Modal>
    );
}
