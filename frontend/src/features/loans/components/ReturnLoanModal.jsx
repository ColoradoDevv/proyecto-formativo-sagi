import { useState, useEffect } from "react";
import { Input, TextArea, Button, Modal, showAlert } from "@/shared";
import { buildReturnSchema, VALID_CONDITIONS } from "../schemas/returnSchema";
import { returnLoan } from "../services/returnService";
import { AlertTriangle } from "lucide-react";

// Metadatos de cada condición: etiqueta, descripción y estilo visual.
const CONDITION_META = {
    Bueno: {
        label: "Bueno",
        description: "El material se devuelve en buen estado y vuelve al inventario disponible.",
        style: "border-success text-success bg-success-soft",
    },
    Mantenimiento: {
        label: "Mantenimiento",
        description: "El material presenta daños o desgaste. Pasará a estado Mantenimiento para revisión técnica.",
        style: "border-warning text-warning bg-warning-soft",
    },
    Baja: {
        label: "Baja",
        description: "El material está inutilizable. Será dado de baja permanentemente del inventario.",
        style: "border-error text-error bg-error-soft",
    },
};

// Modal para devolver un préstamo.
// - Devolutivo: solo observaciones (el material vuelve al inventario).
// - Consumo: cantidad sobrante (obligatoria) + observaciones.
// Al confirmar, finaliza el préstamo y actualiza el inventario (backend).
export default function ReturnLoanModal({ isOpen, onClose, loan, onReturned }) {
    const [formData, setFormData] = useState({
        leftoverQuantity: "",
        returnedQuantity: "",
        observations: "",
        materialCondition: "Bueno",
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Limpia el formulario cada vez que se abre.
    useEffect(() => {
        if (isOpen) {
            setFormData({ leftoverQuantity: "", returnedQuantity: "", observations: "", materialCondition: "Bueno" });
            setErrors({});
        }
    }, [isOpen]);

    if (!loan) return null;

    // Un préstamo Pendiente no puede devolverse: aún no está activo.
    if (loan.state === "Pendiente") {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Devolver Material">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="text-body text-text-primary font-medium">
                        Préstamo pendiente de firma
                    </p>
                    <p className="text-small text-text-secondary">
                        Este préstamo aún no está activo. Para registrar una devolución,
                        ambas partes deben firmar primero el préstamo mediante el enlace
                        enviado por correo.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-2 text-small text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </Modal>
        );
    }

    const isConsumo = loan.material_type === "consumo";

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const schema = buildReturnSchema({
            materialType: loan.material_type,
            amountLent: loan.amount_lent,
        });
        const result = schema.safeParse(formData);

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                fieldErrors[issue.path[0]] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            await returnLoan({
                loanId: loan.id_loan,
                leftoverQuantity: isConsumo ? result.data.leftoverQuantity : undefined,
                returnedQuantity: isConsumo ? undefined : result.data.returnedQuantity,
                observations: result.data.observations,
                materialCondition: result.data.materialCondition,
            });

            const condition = result.data.materialCondition;
            const incomplete = !isConsumo && Number(result.data.returnedQuantity) < loan.amount_lent;

            // Determinar título y texto según condición y tipo de devolución
            let icon  = "success";
            let iconColor = "var(--color-success)";
            let title = isConsumo ? "Sobrante registrado y préstamo finalizado" : "Material devuelto exitosamente";
            let text  = undefined;

            if (condition === "Mantenimiento") {
                icon = "warning";
                iconColor = "var(--color-warning)";
                title = "Devolución registrada — Material en Mantenimiento";
                text  = `El material "${loan.material}" ha sido enviado a Mantenimiento para revisión técnica.`;
            } else if (condition === "Baja") {
                icon = "warning";
                iconColor = "var(--color-error)";
                title = "Devolución registrada — Material dado de Baja";
                text  = `El material "${loan.material}" ha sido dado de baja permanentemente del inventario.`;
            } else if (incomplete) {
                icon = "warning";
                iconColor = "var(--color-error)";
                title = "Devolución incompleta registrada";
                text  = `Se devolvieron ${result.data.returnedQuantity} de ${loan.amount_lent}. El préstamo queda como incompleto.`;
            }

            await showAlert({ icon, iconColor, title, text });
            onReturned?.(loan.id_loan);
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "Error al registrar la devolución",
                text: error.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <>
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                Cancelar
            </Button>
            <Button type="submit" form="return-loan-form" variant="primary" size="md" disabled={submitting}>
                {submitting ? "Procesando..." : "Confirmar devolución"}
            </Button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Devolver Material" footer={footer}>
            <form id="return-loan-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">

                {/* Resumen del préstamo (solo lectura) */}
                <div className="flex flex-col gap-1 rounded-[var(--radius-xl)] border border-border bg-surface-hover px-4 py-3">
                    <p className="text-small text-text-primary">
                        <span className="text-text-muted">Material:</span> {loan.material}
                    </p>
                    <p className="text-small text-text-primary">
                        <span className="text-text-muted">Cantidad prestada:</span> {loan.amount_lent}
                    </p>
                    <p className="text-small text-text-muted">
                        {isConsumo
                            ? "Material de consumo — registra la cantidad sobrante que se reintegra al stock."
                            : "Material devolutivo — indica cuántas unidades se devuelven."}
                    </p>
                </div>

                {isConsumo ? (
                    <Input
                        label="Cantidad sobrante"
                        name="leftoverQuantity"
                        type="number"
                        min="0"
                        step="1"
                        placeholder={`Máximo ${loan.amount_lent}`}
                        value={formData.leftoverQuantity}
                        onChange={handleChange}
                        error={errors.leftoverQuantity}
                        required
                    />
                ) : (
                    <div className="flex flex-col gap-1">
                        <Input
                            label="Cantidad devuelta"
                            name="returnedQuantity"
                            type="number"
                            min="1"
                            step="1"
                            placeholder={`Prestadas: ${loan.amount_lent}`}
                            value={formData.returnedQuantity}
                            onChange={handleChange}
                            error={errors.returnedQuantity}
                            required
                        />
                        {/* Aviso en vivo de devolución incompleta */}
                        {formData.returnedQuantity !== "" &&
                            /^\d+$/.test(formData.returnedQuantity) &&
                            Number(formData.returnedQuantity) < loan.amount_lent && (
                                <p className="text-small text-error">
                                    Devolución incompleta: faltarían{" "}
                                    {loan.amount_lent - Number(formData.returnedQuantity)} unidad(es).
                                </p>
                            )}
                    </div>
                )}

                <TextArea
                    label="Observaciones"
                    name="observations"
                    placeholder="Estado en que se devuelve el material…"
                    value={formData.observations}
                    onChange={handleChange}
                    error={errors.observations}
                />

                {/* Condición del material */}
                <div className="flex flex-col gap-2">
                    <p className="text-small font-medium text-text-primary">
                        Condición del material <span className="text-error">*</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {VALID_CONDITIONS.map((cond) => {
                            const meta    = CONDITION_META[cond];
                            const checked = formData.materialCondition === cond;
                            return (
                                <label
                                    key={cond}
                                    className={`flex flex-col gap-1 cursor-pointer rounded-[var(--radius-xl)] border-2 px-3 py-2 transition-all
                                        ${checked ? meta.style : "border-border text-text-secondary hover:border-text-muted"}`}
                                >
                                    <input
                                        type="radio"
                                        name="materialCondition"
                                        value={cond}
                                        checked={checked}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <span className="text-small font-medium">{meta.label}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Descripción de la condición seleccionada */}
                    {formData.materialCondition && formData.materialCondition !== "Bueno" && (
                        <div className={`flex items-start gap-2 rounded-[var(--radius-xl)] border px-3 py-2
                            ${CONDITION_META[formData.materialCondition]?.style ?? ""}`}>
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <p className="text-small">
                                {CONDITION_META[formData.materialCondition]?.description}
                            </p>
                        </div>
                    )}
                    {errors.materialCondition && (
                        <p className="text-small text-error">{errors.materialCondition}</p>
                    )}
                </div>
            </form>
        </Modal>
    );
}
