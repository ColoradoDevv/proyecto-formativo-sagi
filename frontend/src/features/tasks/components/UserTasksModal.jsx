import { useState } from "react";
import { Plus, ClipboardList, Search } from "lucide-react";
import { Button, Input, Modal, usePermissions } from "@/shared";
import TaskStateBadge from "./TaskStateBadge";
import TaskAssignmentModal from "./TaskAssignmentModal";
import AssignmentRowActions from "./AssignmentRowActions";
import useTaskAssignments from "../hooks/useTaskAssignments";
import { getDefinitions } from "../services/taskService";

// Modal para gestionar las asignaciones de tarea de un usuario concreto.
// Solo aplica en modo "edit" (con userId), porque las asignaciones se
// crean despues de existir el usuario. El registro de usuario ya no
// incluye tareas en memoria.
//
// Vistas:
//   - "list":     lista de asignaciones del usuario + boton para asignar mas.
//   - "existing": buscador para elegir una tarea existente y asignarla.
export default function UserTasksModal({
    isOpen,
    onClose,
    userId = null,
    users = [],
    groups = [],
    definitions: externalDefinitions = null,
}) {
    const { can } = usePermissions();
    const canEdit = can("edit_task_assignment");
    const canDelete = can("delete_task_assignment");
    const canCreate = can("create_task_assignment");

    const [view, setView] = useState("list");

    // Solo se listan las asignaciones de scope=user para este usuario concreto.
    // Las asignaciones a grupos se gestionan en otras vistas (TaskAssignmentsPanel,
    // TaskListPage), no en la vista individual de un usuario.
    const { assignments, setAssignments, loading, reload } = useTaskAssignments(
        userId ? { user: userId, scope: "user" } : {}
    );

    const [assignOpen, setAssignOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [prefillDefinition, setPrefillDefinition] = useState(null);

    // Vista existing: lista de definiciones para reasignar (lazy load).
    const [defs, setDefs] = useState(externalDefinitions ?? []);
    const [defSearch, setDefSearch] = useState("");
    const [loadingDefs, setLoadingDefs] = useState(false);

    const ensureDefinitions = async () => {
        if (externalDefinitions) return;
        setLoadingDefs(true);
        try {
            const data = await getDefinitions();
            setDefs(data);
        } catch {
            setDefs([]);
        } finally {
            setLoadingDefs(false);
        }
    };

    const onOpenExisting = () => {
        setView("existing");
        setDefSearch("");
        if (!externalDefinitions) ensureDefinitions();
    };

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

    const filteredDefs = defs.filter((d) =>
        (d.name ?? "").toLowerCase().includes(defSearch.trim().toLowerCase())
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Tareas del usuario"
                footer={null}
            >
                {/* VISTA LISTA */}
                {view === "list" && (
                    <div className="flex flex-col gap-4">
                        {loading ? (
                            <p className="text-small text-text-muted text-center py-6">Cargando tareas...</p>
                        ) : assignments.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {assignments.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between gap-3 bg-surface-hover border border-border rounded-[var(--radius-xl)] px-4 py-2.5"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-small text-text-primary truncate font-medium">
                                                {a.task_name}
                                            </span>
                                            <span className="text-small text-text-muted truncate">
                                                {a.start_date} - {a.end_date}
                                            </span>
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
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-center py-6">
                                <ClipboardList size={32} className="text-text-muted" />
                                <p className="text-small text-text-muted">
                                    Este usuario no tiene tareas asignadas todavia.
                                </p>
                            </div>
                        )}

                        {canCreate && (
                            <div className="flex flex-col gap-2">
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    className="flex gap-2 justify-center"
                                    onClick={() => setAssignOpen(true)}
                                >
                                    <Plus size={16} />
                                    Asignar tarea
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="flex gap-2 justify-center"
                                    onClick={onOpenExisting}
                                >
                                    <Search size={16} />
                                    Buscar entre tareas existentes
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* VISTA BUSQUEDA DE TAREAS EXISTENTES */}
                {view === "existing" && (
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => setView("list")}
                            className="flex items-center gap-1 text-small text-text-muted hover:text-text-secondary w-fit cursor-pointer"
                        >
                            ← Volver
                        </button>

                        <Input
                            placeholder="Buscar tarea por nombre..."
                            value={defSearch}
                            onChange={(e) => setDefSearch(e.target.value)}
                        />

                        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                            {loadingDefs ? (
                                <p className="text-small text-text-muted text-center py-6">Cargando tareas...</p>
                            ) : filteredDefs.length === 0 ? (
                                <p className="text-small text-text-muted text-center py-6">No hay tareas que coincidan.</p>
                            ) : (
                                filteredDefs.map((d) => (
                                    <div
                                        key={d.id}
                                        className="flex items-center justify-between gap-3 bg-surface-hover border border-border rounded-[var(--radius-xl)] px-4 py-2.5"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-small text-text-primary truncate font-medium">{d.name}</span>
                                            {d.description && (
                                                <span className="text-small text-text-muted truncate">{d.description}</span>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="soft"
                                            size="sm"
                                            onClick={() => {
                                                setAssignOpen(true);
                                                // Recien al render del modal capturamos la definicion elegida
                                                // via un prefijo en formData. Aqui solo abrimos el modal:
                                                // el componente TaskAssignmentModal se auto-resetea
                                                // cada vez que se monta, pero queremos pasarle la
                                                // definicion preseleccionada. La forma limpia es
                                                // guardarla en un estado aparte:
                                                setPrefillDefinition(d);
                                            }}
                                        >
                                            Asignar
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de creacion de asignacion (boton "Asignar tarea") */}
            <TaskAssignmentModal
                isOpen={assignOpen}
                onClose={() => { setAssignOpen(false); setPrefillDefinition(null); }}
                onSaved={(saved) => { handleSaved(saved, false); setAssignOpen(false); setPrefillDefinition(null); setView("list"); }}
                definitions={defs}
                users={users}
                groups={groups}
                fixedUser={userId}
                prefillDefinition={prefillDefinition}
            />

            {/* Modal de edicion */}
            <TaskAssignmentModal
                isOpen={Boolean(editing)}
                onClose={() => setEditing(null)}
                onSaved={(saved) => { handleSaved(saved, true); setEditing(null); }}
                assignment={editing}
                definitions={defs}
                users={users}
                groups={groups}
            />

            {/* Modal de visualizacion */}
            <TaskAssignmentModal
                isOpen={Boolean(viewing)}
                onClose={() => setViewing(null)}
                assignment={viewing}
                definitions={defs}
                users={users}
                groups={groups}
                readOnly
            />
        </>
    );
}
