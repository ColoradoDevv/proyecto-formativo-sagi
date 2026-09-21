import { useState } from "react";
import { Plus, ClipboardList, Users } from "lucide-react";
import { Button, Modal, usePermissions } from "@/shared";
import useTaskAssignments from "../hooks/useTaskAssignments";
import TaskAssignmentModal from "./TaskAssignmentModal";
import TaskStateBadge from "./TaskStateBadge";
import AssignmentRowActions from "./AssignmentRowActions";

// Panel que muestra las asignaciones de una definicion de tarea concreta.
// Cada asignacion tiene su propio destinatario (usuario o grupo), con su
// estado y fechas editables de forma independiente. Edicion/eliminacion
// reservadas a usuarios con edit_task_assignment / delete_task_assignment.
export default function TaskAssignmentsPanel({
    isOpen,
    onClose,
    definition = null,
    users = [],
    groups = [],
}) {
    const { can } = usePermissions();
    const canEdit = can("edit_task_assignment");
    const canDelete = can("delete_task_assignment");
    const canCreate = can("create_task_assignment");

    const { assignments, setAssignments, loading } = useTaskAssignments(
        definition ? { task: definition.id } : {}
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [createScope, setCreateScope] = useState(null); // 'user' | 'group' | null

    const handleSaved = (saved, isEdit) => {
        if (isEdit) {
            setAssignments((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
        } else {
            setAssignments((prev) => [...prev, saved]);
        }
    };

    const handleDeleted = (id) => {
        setAssignments((prev) => prev.filter((a) => a.id !== id));
    };

    const openCreate = (scope) => {
        setCreateScope(scope);
        setCreateOpen(true);
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={definition ? `Asignaciones: ${definition.name}` : "Asignaciones"}
                footer={null}
            >
                <div className="flex flex-col gap-4">

                    {definition?.description && (
                        <p className="text-small text-text-muted">{definition.description}</p>
                    )}

                    {loading ? (
                        <p className="text-small text-text-muted text-center py-6">Cargando asignaciones...</p>
                    ) : assignments.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {assignments.map((a) => {
                                const isGroup = a.scope === "group";
                                return (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between gap-3 bg-surface-hover border border-border rounded-[var(--radius-xl)] px-4 py-2.5"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span
                                                className={
                                                    "shrink-0 inline-flex items-center justify-center size-7 rounded-[var(--radius-full)] " +
                                                    (isGroup
                                                        ? "bg-brand-soft text-brand"
                                                        : "bg-surface-muted text-text-secondary")
                                                }
                                                title={isGroup ? "Asignacion a grupo" : "Asignacion a usuario"}
                                            >
                                                {isGroup ? <Users size={14} /> : <ClipboardList size={14} />}
                                            </span>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-small text-text-primary truncate font-medium">
                                                    {isGroup ? (a.group_name || a.recipient_name) : (a.user_name || a.recipient_name)}
                                                </span>
                                                <span className="text-[11px] text-text-muted truncate">
                                                    {a.start_date} - {a.end_date}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <TaskStateBadge state={a.state} />
                                            <AssignmentRowActions
                                                assignment={a}
                                                canEdit={canEdit}
                                                canDelete={canDelete}
                                                onView={() => setViewing(a)}
                                                onEdit={() => setEditing(a)}
                                                onDeleted={handleDeleted}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-center py-6">
                            <ClipboardList size={32} className="text-text-muted" />
                            <p className="text-small text-text-muted">
                                Esta tarea aun no tiene asignaciones.
                            </p>
                        </div>
                    )}

                    {canCreate && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                className="flex gap-2 justify-center"
                                onClick={() => openCreate("user")}
                            >
                                <Plus size={16} />
                                Asignar a usuario
                            </Button>
                            <Button
                                type="button"
                                variant="soft"
                                size="md"
                                className="flex gap-2 justify-center"
                                onClick={() => openCreate("group")}
                            >
                                <Plus size={16} />
                                Asignar a grupo
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal de creacion (scope decidido por el boton) */}
            <TaskAssignmentModal
                isOpen={createOpen}
                onClose={() => { setCreateOpen(false); setCreateScope(null); }}
                onSaved={(saved) => { handleSaved(saved, false); setCreateOpen(false); setCreateScope(null); }}
                definition={definition}
                definitions={definition ? [definition] : []}
                users={users}
                groups={groups}
                prefillScope={createScope}
            />

            {/* Modal de edicion */}
            <TaskAssignmentModal
                isOpen={Boolean(editing)}
                onClose={() => setEditing(null)}
                onSaved={(saved) => { handleSaved(saved, true); setEditing(null); }}
                assignment={editing}
                definition={definition}
                definitions={definition ? [definition] : []}
                users={users}
                groups={groups}
            />

            {/* Modal de visualizacion */}
            <TaskAssignmentModal
                isOpen={Boolean(viewing)}
                onClose={() => setViewing(null)}
                assignment={viewing}
                definition={definition}
                definitions={definition ? [definition] : []}
                users={users}
                groups={groups}
                readOnly
            />
        </>
    );
}
