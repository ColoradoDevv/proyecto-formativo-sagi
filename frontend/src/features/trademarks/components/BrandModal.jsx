import { useState, useEffect } from "react";
import { Input, Button, Modal, showAlert } from "@/shared";
import { brandSchema } from "../schemas/brandSchema";
import { createBrand, updateBrand } from "../services/brandService";
import BrandForm from "./BrandForm";

// Modal de marca con tres modos:
// - mode "view"   -> muestra los datos en solo lectura, con boton para pasar a edicion.
// - mode "edit"   -> formulario para editar el nombre, con persistencia.
// - mode "create" -> formulario para registrar una nueva marca.
export default function BrandModal({ isOpen, onClose, brand = null, mode = "view", onUpdated, onCreated }) {
    const [view, setView] = useState(mode);
    const [formData, setFormData] = useState({ brandName: "" });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Al abrir, sincroniza el modo solicitado y carga el nombre (vacio en create).
    useEffect(() => {
        if (!isOpen) return;
        setView(mode);
        setFormData({ brandName: brand?.name ?? "" });
        setErrors({});
    }, [isOpen, mode, brand]);

    const isCreate = view === "create";
    const isEdit = view === "edit";
    const isForm = isCreate || isEdit;

    // En view/edit se necesita una marca; en create no.
    if (!isCreate && !brand) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = brandSchema.safeParse(formData);

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
            if (isCreate) {
                const created = await createBrand(result.data);
                await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Marca registrada exitosamente" });
                onCreated?.(created);
            } else {
                const updated = await updateBrand(brand.id, result.data);
                await showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Marca actualizada exitosamente" });
                onUpdated?.(updated);
            }
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: isCreate ? "Error al registrar la marca" : "Error al actualizar la marca",
                text: error.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Botones del footer segun el modo.
    const footer = isForm ? (
        <>
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                Cancelar
            </Button>
            <Button type="submit" form="brand-form" variant="primary" size="md" disabled={submitting}>
                {submitting ? "Guardando..." : isCreate ? "Crear" : "Guardar cambios"}
            </Button>
        </>
    ) : (
        <>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
                Cerrar
            </Button>
            <Button type="button" variant="primary" size="md" onClick={() => setView("edit")}>
                Editar
            </Button>
        </>
    );

    const title = isCreate ? "Registrar Marca" : isEdit ? "Editar Marca" : "Visualizar Marca";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
            {isForm ? (
                <form id="brand-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <BrandForm
                        value={formData.brandName}
                        onChange={handleChange}
                        error={errors.brandName}
                        autoFocus
                    />
                </form>
            ) : (
                <div className="flex flex-col gap-4">
                    <Input label="ID" value={brand.id ?? ""} disabled readOnly />
                    <Input label="Nombre" value={brand.name ?? ""} disabled readOnly />
                </div>
            )}
        </Modal>
    );
}
