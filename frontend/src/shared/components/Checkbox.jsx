export default function Checkbox({
    id,                         // Identificador unico (Necesario para accesibilidad)
    name,                       // Nombre del campo (Util para formularios)
    label,                      // Texto visible asociado al checkbox
    title,                      // Texto completo para tooltip (util cuando label esta truncado)
    checked = false,            // Estado del checkbox (true o false)
    onChange,                   // Función que maneja el cambio de estado
    disable = false,            // Indica si el checkbox esta habilitado
    className = "",             // Clases adicionales para personalización
    required
}) {

    return (
        <label
            htmlFor={id}
            title={title}
            className={`
                flex
                items-center
                gap-2
                min-w-0
                text-small
                cursor-pointer
                ${disable ? "opacity-50 cursor-not-allowed" : ""}
                ${className}
            `}
        >
            {/* Input */}
            <input
                type="checkbox"
                required={required}
                id={id}
                name={name}
                checked={checked}
                onChange={onChange}
                disabled={disable}
                className="w-5 h-5 accent-text-primary shrink-0"
            />
            {/* Texto del checkbox */}
            <span className="min-w-0 flex-1">{label}</span>
            {required && <span className="text-error ml-1">*</span>}
        </label>
    )
}