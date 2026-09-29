import { useState, useEffect } from "react";
import { Input, TextArea, Button, Modal, showAlert } from "@/shared";
import { categorySchema } from "../schemas/categorySchema";
import { createCategory, updateCategory } from "../services/categoryService";
import CategoryForm from "./CategoryForm";

// Modal de categoria con tres modos:
// - mode "view"   -> muestra los datos en solo lectura, con boton para pasar a edicion.
// - mode "edit"   -> formulario para editar nombre y descripcion, con persistencia.
// - mode "create" -> formulario para registrar una nueva categoria.
export default function CategoryModal({ isOpen, onClose, category = null, mode = "view", onUpdated, onCreated }) {
    const [view, setView] = useState(mode);
    const [formData, setFormData] = useState({ categoryName: "", categoryDescription: "" });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setView(mode);
        setFormData({
            categoryName: category?.name ?? "",
            categoryDescription: category?.description ?? "",
        });
        setErrors({});
    }, [isOpen, mode, category]);

    const isCreate = view === "create";
    const isEdit = view === "edit";
    const isForm = isCreate || isEdit;

    if (!isCreate && !category) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = categorySchema.safeParse(formData);
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
                const created = await createCategory(result.data);
                await showAlert({
                    icon: "success",
                    iconColor: "var(--color-success)",
                    title: "Categoria registrada exitosamente",
                });
                onCreated?.(created);
            } else {
                const updated = await updateCategory(category.id, result.data);
                await showAlert({
                    icon: "success",
                    iconColor: "var(--color-success)",
                    title: "Categoria actualizada exitosamente",
                });
                onUpdated?.(updated);
            }
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: isCreate ? "Error al registrar la categoria" : "Error al actualizar la categoria",
                text: error.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const footer = isForm ? (
        <>
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                Cancelar
            </Button>
            <Button type="submit" form="category-form" variant="primary" size="md" disabled={submitting}>
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

    const title = isCreate
        ? "Registrar Categoria"
        : isEdit
            ? "Editar Categoria"
            : "Visualizar Categoria";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
            {isForm ? (
                <form id="category-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <CategoryForm
                        nameValue={formData.categoryName}
                        nameError={errors.categoryName}
                        nameOnChange={handleChange}
                        descriptionValue={formData.categoryDescription}
                        descriptionError={errors.categoryDescription}
                        descriptionOnChange={handleChange}
                        autoFocus
                    />
                </form>
            ) : (
                <div className="flex flex-col gap-4">
                    <Input label="ID" value={category.id ?? ""} disabled readOnly />
                    <Input label="Nombre" value={category.name ?? ""} disabled readOnly />
                    <TextArea
                        label="Descripcion"
                        value={category.description ?? ""}
                        disabled
                        readOnly
                    />
                </div>
            )}
        </Modal>
    );
}
