import { setSession, setStoredPermissions, broadcastNewLogin } from "@/shared/services/api";

// Paso temporal MFA: fetch crudo con el token temporal (NO apiFetch: ese
// adjunta el token de sesión y convierte los 401 en cierre de sesión).
async function mfaFetch(mfaToken, path, body) {
    const response = await fetch(`/api/users/me/mfa/${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mfaToken}`,
        },
        body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || "No se pudo completar la verificación");
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export function enrollMfa(mfaToken, password) {
    return mfaFetch(mfaToken, "enroll/", password ? { password } : undefined);
}

export function confirmMfa(mfaToken, code) {
    return mfaFetch(mfaToken, "confirm/", { code });
}

export function verifyMfa(mfaToken, { code, recovery_code } = {}) {
    return mfaFetch(mfaToken, "verify/", { code, recovery_code });
}

// Completa la sesión igual que login(): guarda token+usuario, avisa a
// otras pestañas y carga permisos (salvo cambio de clave pendiente).
export async function completeMfaSession(data) {
    setSession(data.token, data.user);
    broadcastNewLogin(data.user?.id);
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
            setStoredPermissions([]);
        }
    } else {
        setStoredPermissions([]);
    }
    return data;
}
