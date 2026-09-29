import { useState } from "react";
import Input from "./Input";

// Contenido montado dentro de un promptAlert: texto descriptivo + el Input
// del sistema de diseño. `onValueChange` avisa al promptAlert (fuera de
// React) del valor actual, ya que SweetAlert2 resuelve la promesa de forma
// imperativa (preConfirm) y necesita leerlo en ese momento.
export default function PromptInput({
    text,
    label,
    placeholder,
    initialValue = "",
    error,
    onValueChange,
}) {
    const [value, setValue] = useState(initialValue);

    const handleChange = (e) => {
        setValue(e.target.value);
        onValueChange(e.target.value);
    };

    return (
        <div className="flex flex-col gap-3 text-left">
            {text && <p className="text-small text-text-secondary">{text}</p>}
            <Input
                label={label}
                placeholder={placeholder}
                value={value}
                error={error}
                autoFocus
                onChange={handleChange}
            />
        </div>
    );
}
