import { useState, useEffect } from "react";
import { Input, TextArea, Button, Modal, showAlert } from "@/shared";
import { taskDefinitionSchema } from "../schemas/taskSchema";
import { createDefinition, updateDefinition } from "../services/taskService";

const EMPTY_DEFINITION = {
    taskName: "",
    taskDescription: "",
};

// Modal de creacion / edicion de la PLANTILLA de tarea (TaskDefinition).
// Solo edita nombre y descripcion. El usuario, estado y fechas viven en la
// asignacion, no aqui.
//
// - Sin `definition` -> modo crear.
// - Con `definition` -> modo editar.
export default function TaskDefinitionModal({
    isOpen,
    onClose,
    onSaved,
    definition = null,
    readOnly = false,
}) {
    const isEdit = Boolean(definition) && !readOnly;

    const [formData, setFormData] = useState(EMPTY_DEFINITION);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (definition) {
            setFormData({
                taskName: definition.name ?? "",
                taskDescription: definition.description ?? "",
            });
        } else {
            setFormData(EMPTY_DEFINITION);
        }
        setErrors({});
    }, [definition, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = taskDefinitionSchema.safeParse(formData);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((issue) => {
                const field = issue.path[0];
                if (!fieldErrors[field]) fieldErrors[field] = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            const saved = isEdit
                ? await updateDefinition(definition.id, result.data)
                : await createDefinition(result.data);

            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: isEdit ? "Tarea actualizada exitosamente" : "Tarea creada exitosamente",
            });

            onSaved?.(saved, isEdit);
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: isEdit ? "Error al actualizar la tarea" : "Error al crear la tarea",
                text: error.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const footer = readOnly ? (
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cerrar
        </Button>
    ) : (
        <>
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                Cancelar
            </Button>
            <Button type="submit" form="task-definition-form" variant="primary" size="md" disabled={submitting}>
                {submitting ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
            </Button>
        </>
    );

    const title = readOnly ? "Visualizar Tarea" : isEdit ? "Editar Tarea" : "Crear Tarea";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
        >
            <form id="task-definition-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-1">
                <Input
                    label="Titulo de la Tarea"
                    name="taskName"
                    placeholder="Ingrese el titulo de la tarea"
                    className="w-full"
                    value={formData.taskName}
                    onChange={handleChange}
                    error={errors.taskName}
                    disabled={readOnly}
                    required
                />

                <TextArea
                    label="Descripcion"
                    name="taskDescription"
                    placeholder="Ingrese una descripcion"
                    value={formData.taskDescription}
                    onChange={handleChange}
                    error={errors.taskDescription}
                    disabled={readOnly}
                    required
                />
            </form>
        </Modal>
    );
}
