import { createRoot } from "react-dom/client";
import { swalBase } from "./swalConfig";
import Button from "../components/Button";

// Oculta los botones nativos de SweetAlert2 y monta nuestro componente
// Button en su lugar, conectado a la API imperativa de SweetAlert2
// (clickConfirm/clickCancel) para conservar el comportamiento nativo
// (loader, Enter/Esc, foco) sin duplicar estilos a mano.
export function renderActionButtons({ confirmText, cancelText, showCancelButton }) {
    const actions = swalBase.getActions();
    const confirmButton = swalBase.getConfirmButton();
    const cancelButton = swalBase.getCancelButton();

    confirmButton.style.display = "none";
    if (cancelButton) cancelButton.style.display = "none";

    const container = document.createElement("div");
    container.className = "flex gap-3 w-full";
    actions.appendChild(container);

    const root = createRoot(container);
    root.render(
        <>
            {showCancelButton && (
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={() => swalBase.clickCancel()}
                >
                    {cancelText ?? "Cancelar"}
                </Button>
            )}
            <Button
                type="button"
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => swalBase.clickConfirm()}
            >
                {confirmText}
            </Button>
        </>
    );

    return root;
}
