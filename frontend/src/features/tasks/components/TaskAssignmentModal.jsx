import { useState, useEffect } from "react";
import { Input, Select, Button, Modal, showAlert } from "@/shared";
import { taskAssignmentSchema, TASK_STATES, ASSIGNMENT_SCOPES } from "../schemas/taskSchema";
import { createAssignment, updateAssignment } from "../services/taskService";

const EMPTY_ASSIGNMENT = {
    assignmentScope: "user",
    task: "",
    taskUser: "",
    taskGroup: "",
    taskState: "Pendiente",
    taskStartDate: "",
    taskEndDate: "",
};

// Modal de creacion / edicion de la ASIGNACION de tarea a un destinatario
// (usuario individual o grupo de usuarios).
//
// Props:
//   - assignment:   fila existente (modo editar / visualizar)
//   - definitions:  lista de definiciones para el selector de "Tarea"
//   - users:        lista de usuarios para el selector de "Usuario"
//   - groups:       lista de grupos para el selector de "Grupo"
//   - readOnly:     muestra los datos sin permitir cambios
//   - fixedUser:    fuerza el destinatario a un usuario concreto
//                   (por ejemplo al asignar tareas desde la edicion de un usuario).
//                   Implica scope=user y bloquea el selector de alcance/destinatario.
//   - prefillDefinition: id de definicion preseleccionada al crear.
//   - prefillScope: scope preseleccionado al crear ('user' | 'group').
export default function TaskAssignmentModal({
    isOpen,
    onClose,
    onSaved,
    assignment = null,
    definitions = [],
    users = [],
    groups = [],
    readOnly = false,
    fixedUser = null,
    prefillDefinition = null,
    prefillScope = null,
}) {
    const isEdit = Boolean(assignment) && !readOnly;

    const [formData, setFormData] = useState(EMPTY_ASSIGNMENT);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (assignment) {
            setFormData({
                assignmentScope: assignment.scope ?? "user",
                task: assignment.task != null ? String(assignment.task) : "",
                taskUser: assignment.user != null ? String(assignment.user) : "",
                taskGroup: assignment.group != null ? String(assignment.group) : "",
                taskState: assignment.state ?? "Pendiente",
                taskStartDate: assignment.start_date ?? "",
                taskEndDate: assignment.end_date ?? "",
            });
        } else {
            const initialScope = fixedUser
                ? "user"
                : (prefillScope && ASSIGNMENT_SCOPES.some((s) => s.id === prefillScope))
                    ? prefillScope
                    : "user";
            setFormData({
                ...EMPTY_ASSIGNMENT,
                assignmentScope: initialScope,
                task: prefillDefinition ? String(prefillDefinition) : "",
                taskUser: fixedUser ? String(fixedUser) : "",
                taskGroup: "",
            });
        }
        setErrors({});
    }, [assignment, isOpen, fixedUser, prefillDefinition, prefillScope]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            // Al cambiar de scope, limpiamos el destinatario del scope contrario
            // para evitar mezclar valores y para que la validacion Zod no se confunda.
            if (name === "assignmentScope") {
                if (value === "user")  next.taskGroup = "";
                if (value === "group") next.taskUser  = "";
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = taskAssignmentSchema.safeParse(formData);
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
                ? await updateAssignment(assignment.id, result.data)
                : await createAssignment(result.data);

            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: isEdit ? "Asignacion actualizada" : "Tarea asignada correctamente",
            });

            onSaved?.(saved, isEdit);
            onClose();
        } catch (error) {
            if (error.fieldErrors) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
            showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: isEdit ? "Error al actualizar la asignacion" : "Error al asignar la tarea",
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
            <Button type="submit" form="task-assignment-form" variant="primary" size="md" disabled={submitting}>
                {submitting ? "Guardando..." : isEdit ? "Guardar" : "Asignar"}
            </Button>
        </>
    );

    const title = readOnly
        ? "Visualizar Asignacion"
        : isEdit
            ? "Editar Asignacion"
            : "Asignar Tarea";

    const scopeLocked = Boolean(fixedUser) || isEdit;
    const currentScope = formData.assignmentScope;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
        >
            <form id="task-assignment-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-1">

                <Select
                    label="Tarea"
                    name="task"
                    value={formData.task}
                    onChange={handleChange}
                    options={definitions.map((d) => ({ id: String(d.id), label: d.name }))}
                    error={errors.task}
                    disabled={isEdit || readOnly}
                    required
                />

                {/* Selector de alcance: solo si el destinatario no esta fijado por prop */}
                {!scopeLocked && (
                    <div className="flex flex-col gap-1">
                        <label className="block text-small text-text-primary">
                            Asignar a<span className="text-error ml-1">*</span>
                        </label>
                        <div className="inline-flex self-start rounded-[var(--radius-md)] border border-border overflow-hidden">
                            {ASSIGNMENT_SCOPES.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() =>
                                        handleChange({ target: { name: "assignmentScope", value: s.id } })
                                    }
                                    className={
                                        "px-3 py-1.5 text-small font-medium transition-colors " +
                                        (currentScope === s.id
                                            ? "bg-brand text-text-inverse"
                                            : "bg-surface-base text-text-secondary hover:bg-surface-hover") +
                                        (s.id !== ASSIGNMENT_SCOPES[0].id ? " border-l border-border" : "")
                                    }
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        {errors.assignmentScope && (
                            <p className="text-error text-small place-self-start mt-1">
                                {errors.assignmentScope}
                            </p>
                        )}
                    </div>
                )}

                {currentScope === "user" ? (
                    <Select
                        label="Usuario Asignado"
                        name="taskUser"
                        value={formData.taskUser}
                        onChange={handleChange}
                        options={users}
                        error={errors.taskUser}
                        disabled={Boolean(fixedUser) || isEdit || readOnly}
                        required
                    />
                ) : (
                    <Select
                        label="Grupo Asignado"
                        name="taskGroup"
                        value={formData.taskGroup}
                        onChange={handleChange}
                        options={groups}
                        error={errors.taskGroup}
                        disabled={isEdit || readOnly}
                        required
                    />
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
