import { useState, useEffect } from "react";
import { Input, TextArea, Select, Button, Modal, showAlert } from "@/shared";
import { taskSchema, TASK_STATES } from "../schemas/taskSchema";
import { createTask, updateTask } from "../services/taskService";

const EMPTY_TASK = {
    taskName: "",
    taskDescription: "",
    taskUser: "",
    taskState: "Pendiente",
    taskStartDate: "",
    taskEndDate: "",
};

// Modal de creacion/edicion de tareas.
// - Sin `task` -> modo crear.
// - Con `task` -> modo editar (el usuario asignado queda bloqueado: no se reasigna).
export default function TaskModal({ isOpen, onClose, onSaved, users = [], task = null, readOnly = false }) {
    const isEdit = Boolean(task) && !readOnly;

    const [formData, setFormData] = useState(EMPTY_TASK);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Carga los datos de la tarea al abrir en modo edicion; limpia en modo crear.
    useEffect(() => {
        if (task) {
            setFormData({
                taskName: task.name ?? "",
                taskDescription: task.description ?? "",
                taskUser: task.user != null ? String(task.user) : "",
                taskState: task.state ?? "Pendiente",
                taskStartDate: task.start_date ?? "",
                taskEndDate: task.end_date ?? "",
            });
        } else {
            setFormData(EMPTY_TASK);
        }
        setErrors({});
    }, [task, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = taskSchema.safeParse(formData);

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
                ? await updateTask(task.id, result.data)
                : await createTask(result.data);

            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: isEdit ? "Tarea actualizada exitosamente" : "Tarea creada exitosamente",
            });

            onSaved(saved, isEdit);
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
            <Button type="submit" form="task-form" variant="primary" size="md" disabled={submitting}>
                {submitting ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
            </Button>
        </>
    );

    const title = readOnly ? "Visualizar Tarea" : isEdit ? "Editar Tarea" : "Agregar Tarea";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
        >
            <form id="task-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-1">

                <Input
                    label="Título de la Tarea"
                    name="taskName"
                    placeholder="Ingrese el título de la tarea"
                    className="w-full"
                    value={formData.taskName}
                    onChange={handleChange}
                    error={errors.taskName}
                    disabled={readOnly}
                    required
                />

                <TextArea
                    label="Descripción"
                    name="taskDescription"
                    placeholder="Ingrese una descripción"
                    value={formData.taskDescription}
                    onChange={handleChange}
                    error={errors.taskDescription}
                    disabled={readOnly}
                    required
                />

                <Select
                    label="Usuario Asignado"
                    name="taskUser"
                    value={formData.taskUser}
                    onChange={handleChange}
                    options={users}
                    error={errors.taskUser}
                    disabled={isEdit || readOnly}
                    required
                />
                {isEdit && (
                    <p className="text-small text-text-muted mb-1">
                        El usuario asignado no se puede cambiar.
                    </p>
                )}

                <Select
                    label="Estado"
                    name="taskState"
                    value={formData.taskState}
                    onChange={handleChange}
                    options={TASK_STATES}
                    error={errors.taskState}
                    disabled={readOnly}
                    required
                />

                {/* Fechas: apiladas en móvil, lado a lado desde sm */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                        label="Fecha Inicio"
                        name="taskStartDate"
                        type="date"
                        className="w-full min-w-0"
                        value={formData.taskStartDate}
                        onChange={handleChange}
                        error={errors.taskStartDate}
                        disabled={readOnly}
                        required
                    />
                    <Input
                        label="Fecha Fin"
                        name="taskEndDate"
                        type="date"
                        className="w-full min-w-0"
                        value={formData.taskEndDate}
                        onChange={handleChange}
                        error={errors.taskEndDate}
                        disabled={readOnly}
                        required
                    />
                </div>
            </form>
        </Modal>
    );
}
