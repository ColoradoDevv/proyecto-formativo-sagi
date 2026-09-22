import { setSession, clearSession, setStoredPermissions } from "@/shared/services/api";

// METODO POST - inicia sesion y guarda el token
export async function login(email, password) {
    const response = await fetch("/api/users/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    // El backend devuelve 401 si las credenciales son invalidas
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo iniciar sesión");
        error.status = response.status;
        throw error;
    }

    const data = await response.json();

    // Guardamos token + datos del usuario en la sesion
    setSession(data.token, data.user);

    // Obtenemos los codenames de permiso del usuario y los guardamos
    if (!data.user?.must_change_password) {
        try {
            const permRes = await fetch("/api/permissions/permissions/my_permission_codes/", {
                headers: { Authorization: `Bearer ${data.token}` },
            });
            if (permRes.ok) {
                const permData = await permRes.json();
                setStoredPermissions(permData.permissions ?? []);
            }
        } catch {
            // Si falla la carga de permisos no interrumpimos el login;
            // el backend sigue haciendo la validación real.
            setStoredPermissions([]);
        }
    } else {
        setStoredPermissions([]);
    }

    return data;
}

// METODO POST - solicita el envio del correo de recuperacion de contraseña
export async function requestPasswordReset(email) {
    const response = await fetch("/api/users/forgot-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo enviar el correo de recuperación");
        error.status = response.status;
        throw error;
    }

    return response.json().catch(() => ({}));
}

// METODO POST - define la nueva contraseña usando el token del correo
export async function resetPassword(token, password, confirmPassword) {
    const response = await fetch("/api/users/reset-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo restablecer la contraseña");
        error.status = response.status;
        throw error;
    }

    return response.json().catch(() => ({}));
}

// Cierra la sesion: invalida el token en el servidor y luego lo elimina localmente.
export async function logout() {
    const token = (await import("@/shared/services/api")).getToken();

    if (token) {
        try {
            await fetch("/api/users/logout/", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            // Si la petición falla (sin red, servidor caído, etc.) continuamos
            // con el cierre de sesión local igualmente. El token expirará solo
            // en 8h según su claim exp.
        }
    }

    clearSession();
}

// Cambio obligatorio de contraseña en el primer inicio de sesión (sin OTP).
export async function changePasswordFirstLogin({ currentPassword, newPassword, confirmNewPassword }) {
    const FIELD_MAP = {
        current_password: "currentPassword",
        new_password: "newPassword",
        confirm_new_password: "confirmNewPassword",
    };

    const { apiFetch, throwApiError, updateStoredUser } = await import("@/shared/services/api");

    const response = await apiFetch("/api/users/me/change-password/first-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_new_password: confirmNewPassword,
        }),
    });

    if (!response.ok) await throwApiError(response, FIELD_MAP);

    const data = await response.json();
    updateStoredUser({ must_change_password: false });
    return data;
}

// Autorización de tratamiento de datos personales (Ley 1581 de 2012).
// Regulariza cuentas creadas antes de exigir el consentimiento.
export async function acceptDataConsent() {
    const { apiFetch, updateStoredUser } = await import("@/shared/services/api");

    const response = await apiFetch("/api/users/me/consent/", { method: "POST" });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || data.detail || "No se pudo registrar la autorización.");
        error.status = response.status;
        throw error;
    }

    const data = await response.json();
    updateStoredUser({ data_consent: true });
    return data;
}