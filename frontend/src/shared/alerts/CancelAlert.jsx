import { swalBase } from "./swalConfig";
import { renderActionButtons } from "./actionButtons";

export default function cancelAlert({
    icon = "warning",
    title = "¿Cancelar el registro?",
    iconColor,
    text = "Se perderán todos los datos ingresados. ¿Deseas continuar?",
    confirmText = "Sí, cancelar",
    cancelText = "Seguir aquí",
    ...options
} = {}) {
    let root;

    return swalBase.fire({
        icon,
        iconColor,
        title,
        text,
        showCancelButton: true,
        didOpen: () => {
            root = renderActionButtons({ confirmText, cancelText, showCancelButton: true });
        },
        willClose: () => {
            root?.unmount();
        },
        ...options,
    });
}
