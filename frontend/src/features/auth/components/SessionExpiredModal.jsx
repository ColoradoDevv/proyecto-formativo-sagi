import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Clock } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { Button } from "@/shared";
import {
    getExpiredReason,
    clearExpiredReason,
    setExpiredReason,
    getStoredUser,
    getToken,
    clearSession,
    getTabId,
    watchNewLogins,
} from "@/shared/services/api";
import { logout } from "../services/authService";

/**
 * Modal global de sesión expirada.
 *
 * Se monta una sola vez en App.jsx y escucha el evento "sia:session-expired"
 * que dispara apiFetch cuando el backend devuelve 401 por primera vez.
 *
 * Al confirmar:
 *  - Llama a logout() que intenta invalidar el token en el servidor
 *    y limpia sessionStorage
 *  - Redirige a /iniciar-sesion
 *
 * El modal no es cerreable (showClose=false, closeOnBackdrop=false) para
 * obligar al usuario a re-autenticarse.
 */
export default function SessionExpiredModal() {
    const [open, setOpen]   = useState(false);
    const [reason, setReason] = useState("");
    const handlingRef       = useRef(false); // evita doble apertura por peticiones paralelas
    const navigate          = useNavigate();

    useEffect(() => {
        function handleExpired() {
            // Si el modal ya está abierto o en proceso, ignoramos el evento
            if (handlingRef.current) return;
            // No mostramos el modal si ya estamos en login
            if (window.location.pathname === "/iniciar-sesion") return;

            handlingRef.current = true;
            // Motivo específico (ej. sesión reemplazada por otro login) o
            // texto genérico de expiración.
            setReason(getExpiredReason() ?? "");
            setOpen(true);
        }

        window.addEventListener("sia:session-expired", handleExpired);
        return () => window.removeEventListener("sia:session-expired", handleExpired);
    }, []);

    // Cierre proactivo entre pestañas del mismo navegador: si OTRA pestaña
    // avisa de un login del MISMO usuario, esta se cierra sola al instante,
    // sin esperar a que el usuario interactúe (sin recargar nada).
    useEffect(() => {
        return watchNewLogins((message) => {
            if (!message || message.type !== "sia:new-login") return;
            if (message.tabId === getTabId()) return; // fui yo misma
            if (handlingRef.current) return;
            if (window.location.pathname === "/iniciar-sesion") return;
            const me = getStoredUser();
            if (!me || !getToken()) return; // sin sesión aquí: nada que cerrar
            if (message.userId == null || String(message.userId) !== String(me.id)) return; // otro usuario: no me afecta

            handlingRef.current = true;
            const detail = "Se inició sesión en otra ventana con tu cuenta. Esta sesión fue cerrada por seguridad.";
            setExpiredReason(detail);
            setReason(detail);
            clearSession();
            setOpen(true);
        });
    }, []);

    const handleConfirm = useCallback(async () => {
        setOpen(false);
        clearExpiredReason();
        // logout() intentará POST /logout pero la sesión ya está limpia en
        // sessionStorage (apiFetch la limpió al detectar el 401). El catch
        // en logout() ya maneja el fallo silenciosamente.
        await logout();
        handlingRef.current = false;
        setReason("");
        navigate("/iniciar-sesion", { replace: true });
    }, [navigate]);

    return (
        <Modal
            isOpen={open}
            onClose={handleConfirm}
            title={reason ? "Sesión cerrada" : "Sesión expirada"}
            variant="solid"
            size="sm"
            showClose={false}
            closeOnBackdrop={false}
            footer={
                <div className="w-full flex justify-center">
                    <Button onClick={handleConfirm} icon={LogIn}>
                        Iniciar sesión de nuevo
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-warning-soft text-warning">
                    <Clock size={28} />
                </div>
                <div>
                    <p className="text-body text-text-primary font-medium">
                        {reason || "Tu sesión ha expirado"}
                    </p>
                    <p className="text-small text-text-secondary mt-1">
                        {reason
                            ? "Solo se permite una sesión activa por usuario: queda abierta la más reciente."
                            : "Por seguridad, las sesiones cierran automáticamente después de 8 horas. Inicia sesión para continuar."}
                    </p>
                </div>
            </div>
        </Modal>
    );
}
