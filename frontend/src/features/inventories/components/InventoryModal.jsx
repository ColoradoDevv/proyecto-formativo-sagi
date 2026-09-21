import { useState, useEffect } from "react";
import { Input, TextArea, Button, Modal, showAlert } from "@/shared";
import { inventorySchema } from "../schemas/inventorySchema";
import { createInventory, updateInventory } from "../services/inventoryService";
import InventoryForm from "./InventoryForm";

// Modal de inventario con tres modos:
// - mode "view"   -> muestra los datos en solo lectura, con boton para pasar a edicion.
// - mode "edit"   -> formulario para editar nombre y descripcion, con persistencia.
// - mode "create" -> formulario para registrar un nuevo nombre de inventario.
export default function InventoryModal({ isOpen, onClose, inventory = null, mode = "view", onUpdated, onCreated }) {
    const [view, setView] = useState(mode);
    const [formData, setFormData] = useState({ inventoryName: "", inventoryDescription: "" });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Al abrir, sincroniza el modo solicitado y carga los datos (vacio en create).
    useEffect(() => {
        if (!isOpen) return;
        setView(mode);
        setFormData({
            inventoryName: inventory?.name ?? "",
            inventoryDescription: inventory?.description ?? "",
        });
        setErrors({});
    }, [isOpen, mode, inventory]);

    const isCreate = view === "create";
    const isEdit = view === "edit";
    const isForm = isCreate || isEdit;

    if (!isCreate && !inventory) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = inventorySchema.safeParse(formData);
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
                const created = await createInventory(result.data);
                await showAlert({
                    icon: "success",
                    iconColor: "var(--color-success)",
                    title: "Nombre de inventario registrado exitosamente",
                });
                onCreated?.(created);
            } else {
                const updated = await updateInventory(inventory.id, result.data);
                await showAlert({
                    icon: "success",
                    iconColor: "var(--color-success)",
                    title: "Nombre de inventario actualizado exitosamente",
                });
                onUpdated?.(updated);
            }
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: isCreate ? "Error al registrar el nombre de inventario" : "Error al actualizar el nombre de inventario",
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
            <Button type="submit" form="inventory-form" variant="primary" size="md" disabled={submitting}>
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
        ? "Registrar Nombre de Inventario"
        : isEdit
            ? "Editar Nombre de Inventario"
            : "Visualizar Nombre de Inventario";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
            {isForm ? (
                <form id="inventory-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <InventoryForm
                        nameValue={formData.inventoryName}
                        nameError={errors.inventoryName}
                        nameOnChange={handleChange}
                        descriptionValue={formData.inventoryDescription}
                        descriptionError={errors.inventoryDescription}
                        descriptionOnChange={handleChange}
                        autoFocus
                    />
                </form>
            ) : (
                <div className="flex flex-col gap-4">
                    <Input label="ID" value={inventory.id ?? ""} disabled readOnly />
                    <Input label="Nombre" value={inventory.name ?? ""} disabled readOnly />
                    <TextArea
                        label="Descripción"
                        value={inventory.description ?? ""}
                        disabled
                        readOnly
                    />
                </div>
            )}
        </Modal>
    );
}
