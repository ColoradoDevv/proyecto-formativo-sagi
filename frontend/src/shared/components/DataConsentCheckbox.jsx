import Checkbox from "./Checkbox";

const HABEAS_DATA_URL = "https://www.sena.edu.co/es-co/transparencia/Paginas/habeas_data.aspx";

// Checkbox de autorización de tratamiento de datos personales
// (Ley 1581 de 2012, Protección de Datos Personales).
// Variantes:
//   titular — quien se registra/entrega sus propios datos.
//   tercero  — quien registra datos de otra persona (ej. receptor externo
//              de un préstamo) y declara que esa persona ya autorizó.
const TEXTS = {
    titular: (
        <>
            <strong>Autorizo</strong> al SENA el tratamiento de mis datos personales, de acuerdo con la{" "}
            <strong>Ley 1581 de 2012</strong> y el Decreto 1377 de 2013, para las finalidades propias del
            SAGI (Sistema Administrativo de Gestión de Inventarios). Declaro que conozco mis derechos como titular (conocer,
            actualizar, rectificar, suprimir mis datos y revocar esta autorización) y el manual de
            habeas data del SENA.{" "}
            <a
                href={HABEAS_DATA_URL}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline underline-offset-2 hover:opacity-80"
                onClick={(e) => { e.preventDefault(); window.open(HABEAS_DATA_URL, '_blank', 'noopener,noreferrer'); }}
            >
                Ver política de tratamiento
            </a>
            .
        </>
    ),
    tercero: (
        <>
            <strong>Autorizo</strong> el uso de estos datos (nombre y correo) únicamente para la gestión y
            firma de este préstamo. Declaro que su titular ya autorizó su tratamiento conforme a la{" "}
            <strong>Ley 1581 de 2012</strong>.{" "}
            <a
                href={HABEAS_DATA_URL}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline underline-offset-2 hover:opacity-80"
                onClick={(e) => { e.preventDefault(); window.open(HABEAS_DATA_URL, '_blank', 'noopener,noreferrer'); }}
            >
                Ver política de tratamiento
            </a>
            .
        </>
    ),
};

export default function DataConsentCheckbox({
    id,
    name,
    checked = false,
    onChange,
    error,
    variant = "titular",
    className = "",
}) {
    return (
        <div className={className}>
            <div
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 bg-surface-hover transition-colors ${
                    error ? "border-error" : "border-border"
                }`}
            >
                <Checkbox
                    id={id}
                    name={name}
                    label={<span className="text-small text-text-secondary leading-snug">{TEXTS[variant] ?? TEXTS.titular}</span>}
                    checked={checked}
                    onChange={onChange}
                />
            </div>
            {error && (
                <p className="text-error text-small place-self-start mt-1">{error}</p>
            )}
        </div>
    );
}
