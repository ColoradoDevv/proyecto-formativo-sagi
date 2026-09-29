import { swalBase } from "./swalConfig";
import { renderActionButtons } from "./actionButtons";

export default function showAlert({
    icon,
    iconColor,
    title = "",
    text = "",
    confirmText = "Aceptar",
    cancelText,
    showCancelButton = false,
    timer,
    ...options
} = {}) {
    let root;

    return swalBase.fire({
        icon,
        iconColor,
        title,
        text,
        timer,
        timerProgressBar: Boolean(timer),
        showCancelButton,
        didOpen: () => {
            root = renderActionButtons({ confirmText, cancelText, showCancelButton });
        },
        willClose: () => {
            root?.unmount();
        },
        ...options,
    });
}
