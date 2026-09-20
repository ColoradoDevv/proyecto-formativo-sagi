import AppRouter from "./router";
import SessionExpiredModal from "@/features/auth/components/SessionExpiredModal";
import MandatoryPasswordChangeModal from "@/features/auth/components/MandatoryPasswordChangeModal";

export default function App() {

    return (
        <>
            <AppRouter />
            {/* Modal global de sesión expirada — escucha el evento sia:session-expired
                que dispara apiFetch ante cualquier 401 del backend. */}
            <SessionExpiredModal />
            {/* Modal global de cambio obligatorio de contraseña en primer inicio de sesión. */}
            <MandatoryPasswordChangeModal />
        </>
    );
}
