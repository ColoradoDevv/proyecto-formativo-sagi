import { useState } from "react";
import { Switch, cancelAlert, showAlert } from "@/shared";

export default function ActiveSwitch({ id, isActive, toggleFn, entity = "material", size = "md", onToggled, beforeToggle }) {
    const [active, setActive] = useState(isActive);

    const handleChange = async (value) => {
        const result = await cancelAlert({
            title: value ? `¿Activar ${entity}?` : `¿Desactivar ${entity}?`,
            text: value
                ? `El ${entity} volverá a estar disponible en el sistema.`
                : `El ${entity} no podrá ser usado mientras esté inactivo.`,
            confirmText: value ? "Sí, activar" : "Sí, desactivar",
            cancelText: "Cancelar",
        });

        if (!result.isConfirmed) return;

        const extraData = beforeToggle ? await beforeToggle(value) : undefined;
        if (extraData === false) return;

        try {
            const updatedMaterial = await toggleFn(id, value, extraData);
            setActive(updatedMaterial.is_active);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: value ? "Activado correctamente" : "Desactivado correctamente",
                timer: 2500,
            });
            onToggled?.(updatedMaterial);
        } catch (error) {
            console.error("Error al actualizar estado:", error);
            await showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: `No se pudo ${value ? "activar" : "desactivar"} el ${entity}`,
                text: error.message,
            });
        }
    };

    return <Switch checked={active} onChange={handleChange} size={size} className="inline-flex" />;
}
