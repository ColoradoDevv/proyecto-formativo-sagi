import { useEffect, useState } from "react";
import { Button, FileInput, Modal, showAlert } from "@/shared";
import { CircleCheck } from "lucide-react";
import { finishAssignment, uploadTaskEvidence } from "../services/taskService";

// Modal para que el asignado marque SU tarea como terminada.
// - Si la tarea exige evidencias, debe adjuntar al menos un archivo.
// - Al confirmar sube las evidencias y pasa la tarea a "En revisión";
//   el revisor recibe el aviso por correo y define el estado final.
export default function SubmitTaskModal({ isOpen, onClose, assignment, onSubmitted }) {
    const [files, setFiles] = useState([]);
    const [fileError, setFileError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFiles([]);
            setFileError("");
        }
    }, [isOpen]);

    if (!assignment) return null;

    const requiresEvidence = assignment.requires_evidence === true;
    const remaining = remainingDays(assignment.end_date);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (requiresEvidence && files.length === 0) {
            setFileError("Esta tarea exige al menos una evidencia (foto o archivo).");
            return;
        }
        setFileError("");
        setSubmitting(true);
        try {
            for (const file of files) {
                await uploadTaskEvidence(assignment.id, file);
            }
            const updated = await finishAssignment(assignment.id);
            await showAlert({
                icon: "success",
                iconColor: "var(--color-success)",
                title: "Tarea entregada para revisión",
                text: "El responsable fue notificado y revisará tu entrega.",
                timer: 4000,
            });
            onSubmitted?.(updated);
            onClose();
        } catch (err) {
            await showAlert({
                icon: "error",
                iconColor: "var(--color-error)",
                title: "No se pudo entregar la tarea",
                text: err.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Finalizar tarea"
            footer={
                <>
                    <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="task-submit-form" variant="primary" size="md" disabled={submitting}>
                        {submitting ? "Entregando..." : "Marcar como terminada"}
                    </Button>
                </>
            }
        >
            <form id="task-submit-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-border bg-surface-hover px-4 py-3">
                    <CircleCheck size={20} className="text-success shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-medium font-medium text-text-primary">
                            {assignment.task_name ?? `Tarea #${assignment.task}`}
                        </p>
                        {assignment.task_description && (
                            <p className="text-small text-text-secondary mt-0.5">
                                {assignment.task_description}
                            </p>
                        )}
                        <p className="text-small text-text-muted mt-1">
                            {remaining.label} · Límite: {assignment.end_date ?? "—"}
                        </p>
                    </div>
                </div>

                <FileInput
                    label="Evidencias"
                    name="evidence"
                    placeholder="Subir fotos o archivos de la tarea terminada"
                    value={files}
                    onChange={setFiles}
                    error={fileError}
                    accept="image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    maxFiles={5}
                    maxSizeMB={5}
                    required={requiresEvidence}
                    description="JPG, PNG, PDF, Excel o Word. Máximo 5MB por archivo, hasta 5 archivos."
                    className="w-full h-14 rounded-2xl"
                />

                <p className="text-small text-text-muted">
                    Al confirmar, la tarea pasará a <strong>En revisión</strong> y se
                    avisará a quien te la asignó para que la revise.
                </p>
            </form>
        </Modal>
    );
}

function remainingDays(endDate) {
    if (!endDate) return { label: "Sin fecha límite" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(end.getTime())) return { label: "Sin fecha límite" };
    const diff = Math.round((end - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `Vencida hace ${Math.abs(diff)} día(s)`, overdue: true };
    if (diff === 0) return { label: "Vence hoy" };
    return { label: `Quedan ${diff} día(s)` };
}
