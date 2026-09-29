import { createRoot } from "react-dom/client";
import { swalBase } from "./swalConfig";
import { renderActionButtons } from "./actionButtons";
import PromptInput from "../components/PromptInput";

// Alerta con un campo de texto, para pedir un dato corto sin salir del
// flujo de confirmacion (ej. nombre de un grupo nuevo). Usa el Input y
// Button del sistema de diseño en vez de los nativos de SweetAlert2.
export default function promptAlert({
    icon,
    iconColor,
    title = "",
    text = "",
    inputLabel,
    inputPlaceholder,
    inputValidator,
    confirmText = "Aceptar",
    cancelText = "Cancelar",
    ...options
} = {}) {
    let actionsRoot;
    let inputRoot;
    let currentValue = "";

    const renderInput = (error) => {
        inputRoot.render(
            <PromptInput
                text={text}
                label={inputLabel}
                placeholder={inputPlaceholder}
                initialValue={currentValue}
                error={error}
                onValueChange={(value) => { currentValue = value; }}
            />
        );
    };

    return swalBase.fire({
        icon,
        iconColor,
        title,
        html: '<div class="swal-prompt-mount"></div>',
        showCancelButton: true,
        focusConfirm: false,
        didOpen: (popup) => {
            actionsRoot = renderActionButtons({ confirmText, cancelText, showCancelButton: true });

            const container = popup.querySelector(".swal-prompt-mount");
            inputRoot = createRoot(container);
            renderInput();
        },
        preConfirm: () => {
            if (inputValidator) {
                const message = inputValidator(currentValue);
                if (message) {
                    renderInput(message);
                    return false;
                }
            }
            return currentValue;
        },
        willClose: () => {
            actionsRoot?.unmount();
            inputRoot?.unmount();
        },
        ...options,
    });
}
