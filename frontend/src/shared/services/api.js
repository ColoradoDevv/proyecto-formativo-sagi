//
// Capa central de comunicacion con el backend.
// Guarda la sesion (token + usuario) y adjunta el token en cada peticion.
//

const TOKEN_KEY = "sia_token";
const USER_KEY = "sia_user";
const PERMISSIONS_KEY = "sia_permissions";

// --- Manejo de la sesion en sessionStorage ---

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("sia:session-updated"));
}

export function updateStoredUser(updates) {
    const user = getStoredUser();
    if (!user) return null;
    const updated = { ...user, ...updates };
    sessionStorage.setItem(USER_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("sia:session-updated"));
    return updated;
}

export function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PERMISSIONS_KEY);
}

export function getStoredUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

export function setStoredPermissions(permissions) {
    sessionStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
    // Notifica a usePermissions (y cualquier suscriptor) que los permisos cambiaron.
    window.dispatchEvent(new Event("sia:permissions-updated"));
}

export function getStoredPermissions() {
    const raw = sessionStorage.getItem(PERMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
}

export function isAuthenticated() {
    return Boolean(getToken());
}

// Construye la URL de un archivo de /media/ con el token de sesión.
// Los <img> y <a> no pueden enviar el header Authorization, así que el
// backend acepta el JWT por query (?auth=). Idempotente: si ya lo trae,
// no lo duplica. Las URLs que no son de /media/ se devuelven intactas.
export function mediaUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (!url.startsWith("/media/")) return url;
    if (url.includes("auth=")) return url;
    const token = getToken();
    if (!token) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}auth=${encodeURIComponent(token)}`;
}

// --- Wrapper de fetch que adjunta el token automaticamente ---

// --- Manejo centralizado de errores HTTP ---

const HTTP_ERROR_MESSAGES = {
    400: "Solicitud inválida. Verifica los datos enviados.",
    401: "No autenticado. Por favor, inicia sesión.",
    403: "No tienes permisos para realizar esta acción.",
    404: "El recurso solicitado no fue encontrado.",
    409: "Conflicto: ya existe un registro con esos datos.",
    422: "Los datos enviados no son procesables por el servidor.",
    429: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
    500: "Error interno del servidor. Intenta más tarde.",
    502: "El servidor no está disponible (Bad Gateway).",
    503: "Servicio temporalmente no disponible. Intenta más tarde.",
};

// Lanza un Error a partir de una respuesta HTTP fallida. Si el backend (DRF)
// devuelve errores por campo (ej. { name: ["brand with this name already exists."] }),
// el Error incluye `fieldErrors` -mapeados a los nombres de campo del formulario
// via `fieldMap`- y un mensaje legible que junta esos mensajes en vez del genérico.
// Los 401 lanzan un error silencioso: apiFetch ya disparó sia:session-expired y el
// modal global guía al usuario — no queremos que la UI muestre un error adicional.
export async function throwApiError(response, fieldMap = {}) {
    if (response.status === 401) {
        // Error marcado como silencioso para que los hooks no lo muestren en pantalla.
        const silent = new Error("session_expired");
        silent.silent = true;
        throw silent;
    }

    const fallback = HTTP_ERROR_MESSAGES[response.status] ?? `Error inesperado del servidor (código ${response.status}).`;

    let body = null;
    try { body = await response.json(); } catch { /* sin body JSON */ }

    const error = new Error(fallback);
    error.status = response.status;

    if (body && typeof body === "object") {
        if (typeof body.detail === "string") {
            error.message = body.detail;
        } else {
            const fieldErrors = {};
            const messages = [];

            for (const [key, value] of Object.entries(body)) {
                const text = Array.isArray(value) ? value.join(" ") : String(value);
                if (key === "non_field_errors") {
                    messages.push(text);
                } else {
                    fieldErrors[fieldMap[key] ?? key] = text;
                    messages.push(text);
                }
            }

            if (Object.keys(fieldErrors).length) error.fieldErrors = fieldErrors;
            if (messages.length) error.message = messages.join(" ");
        }
    }

    throw error;
}

export async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    // Si hay token, lo mandamos en el header Authorization
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Si el token expiró o es inválido, disparamos un evento global para que
    // SessionExpiredModal muestre el aviso al usuario antes de limpiar la sesión.
    // La limpieza real ocurre cuando el usuario confirma el modal.
    // También limpiamos aquí para que isAuthenticated() devuelva false de inmediato
    // y ProtectedRoute redirija si se recarga la página.
    if (response.status === 401) {
        const alreadyExpired = !getToken(); // ya fue limpiado por una petición anterior
        clearSession();
        if (!alreadyExpired) {
            // Solo disparamos el evento la primera vez que detectamos el 401
            // (las peticiones paralelas no deben abrir el modal varias veces).
            window.dispatchEvent(new CustomEvent("sia:session-expired"));
        }
    }

    return response;
}