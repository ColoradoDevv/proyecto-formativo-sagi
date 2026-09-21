import { Input, TextArea } from "@/shared";

// Campo de categoria reutilizable entre crear y editar.
// PRESENTACIONAL: recibe valor, error y handler desde la pagina/modal.
export default function CategoryForm({
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
                label="Nombre de la categoria"
                name="categoryName"
                placeholder="Ej: Tornilleria, Cables, Herramientas"
                value={nameValue}
                onChange={nameOnChange}
                error={nameError}
                maxLength={100}
                autoFocus={autoFocus}
                required
            />
            <TextArea
                label="Descripcion (opcional)"
                name="categoryDescription"
                placeholder="Notas sobre el alcance o uso de esta categoria"
                value={descriptionValue}
                onChange={descriptionOnChange}
                error={descriptionError}
                maxLength={255}
            />
        </>
    );
}
