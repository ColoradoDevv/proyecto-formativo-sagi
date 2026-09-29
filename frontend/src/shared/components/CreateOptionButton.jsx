import { createElement } from "react";
import { IconButton } from "./IconButton";
import promptAlert from "../alerts/PromptAlert";
import showAlert from "../alerts/Alert";

// Botón "+" para el labelAction de un Select: pide un nombre con promptAlert,
// llama a `onCreate(name)` (que crea la entidad y devuelve la opción {id,label})
// y notifica el resultado vía `onCreated(option)`.
// Reutilizable para crear marca, categoría, grupo, etc. al vuelo desde un formulario.
export default function CreateOptionButton({
    onCreate,
    onCreated,
    title = "Nuevo registro",
    inputLabel = "Nombre",
    inputPlaceholder = "",
    errorTitle = "No se pudo crear",
    ariaLabel = "Agregar nuevo",
    icon: Icon,
    variant = "button",
}) {
    if (variant === "spacer") {
        return <span aria-hidden="true" className="block shrink-0 size-7" />;
    }

    if (!onCreate) return null;

    const handleClick = async () => {
        const result = await promptAlert({
            title,
            inputLabel,
            inputPlaceholder,
            confirmText: "Crear",
            cancelText: "Cancelar",
            inputValidator: (value) => {
                if (!value || !value.trim()) return "El nombre es obligatorio";
            },
        });

        if (!result.isConfirmed) return;

        try {
            const option = await onCreate(result.value.trim());
            onCreated?.(option);
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: errorTitle, text: error.message });
        }
    };

    return (
        <IconButton
            type="button"
            variant="ghost"
            hitSize={28}
            iconSize={16}
            ariaLabel={ariaLabel}
            onClick={handleClick}
        >
            {Icon && createElement(Icon)}
        </IconButton>
    );
}
