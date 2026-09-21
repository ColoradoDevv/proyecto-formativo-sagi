import { Input, TextArea } from "@/shared";

// Campo de "nombre de inventario" reutilizable entre crear y editar.
// Es PRESENTACIONAL: recibe valor, error y handler desde la pagina/modal.
export default function InventoryForm({
    nameValue,
    nameError,
    nameOnChange,
    descriptionValue,
    descriptionError,
    descriptionOnChange,
    autoFocus = false,
}) {
    return (
        <>
            <Input
                label="Nombre del inventario"
                name="inventoryName"
                placeholder="Ej: Almacén principal, Bodega 2"
                value={nameValue}
                onChange={nameOnChange}
                error={nameError}
                maxLength={100}
                autoFocus={autoFocus}
                required
            />
            <TextArea
                label="Descripción (opcional)"
                name="inventoryDescription"
                placeholder="Notas sobre el alcance o ubicación de este inventario"
                value={descriptionValue}
                onChange={descriptionOnChange}
                error={descriptionError}
                maxLength={255}
            />
        </>
    );
}
