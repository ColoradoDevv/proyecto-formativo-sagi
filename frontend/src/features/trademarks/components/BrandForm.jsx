import { Input } from "@/shared";

// Campo de marca reutilizable entre crear y editar.
// Es PRESENTACIONAL: recibe el valor, el error y el handler desde la pagina/modal.
export default function BrandForm({ value, error, onChange, autoFocus = false }) {
    return (
        <Input
            label="Nombre de la marca"
            name="brandName"
            placeholder="Ej: Asus, HP, Dell"
            value={value}
            onChange={onChange}
            error={error}
            maxLength={100}
            autoFocus={autoFocus}
            required
        />
    );
}
