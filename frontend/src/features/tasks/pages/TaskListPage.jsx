import { useState, useEffect } from "react";
import { Button, DataTable, usePermissions } from "@/shared";
import { Plus, ListChecks, ClipboardList, CloudAlert, Download } from "lucide-react";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";
import useTaskDefinitions from "../hooks/useTaskDefinitions";
import useTaskAssignments from "../hooks/useTaskAssignments";
import { getUsers, getGroups } from "../services/selectServices";
import { assignmentColumns, definitionColumns } from "../table/taskColumns";
import TaskDefinitionModal from "../components/TaskDefinitionModal";
import TaskAssignmentModal from "../components/TaskAssignmentModal";
import TaskAssignmentsPanel from "../components/TaskAssignmentsPanel";
import { tasksAssignmentsReportConfig, tasksDefinitionsReportConfig } from "../reports/tasksReportConfig";

// Pagina principal de tareas.
// Toggle entre dos vistas:
//   - "assignments": una fila por asignacion (usuario o grupo <-> tarea con su estado).
//   - "definitions": una fila por definicion de tarea, con acceso al panel
//     de asignaciones de esa definicion.
export default function TaskListPage() {
    const { can } = usePermissions();
    const canEditAssignment   = can("edit_task_assignment");
    const canDeleteAssignment = can("delete_task_assignment");
    const canDeleteDefinition = can("delete_task");
    const canCreateAssignment = can("create_task_assignment");
    const canCreateDefinition = can("create_task");
    const canEditDefinition   = can("edit_task");
    // La vista de definiciones exige view_task en el backend; sin él solo
    // se muestran asignaciones (evita una tabla vacía por 403 silencioso).
    const canViewDefs = can("view_task");
    const canViewAsg  = can("view_task_assignment");

    const [view, setView] = useState(canViewAsg ? "assignments" : "definitions");
    const showToggle = canViewAsg && canViewDefs;
    // Vista efectiva: nunca mostrar definiciones sin permiso.
    const effectiveView = view === "definitions" && canViewDefs ? "definitions" : "assignments";

    const { definitions, setDefinitions, loading: loadingDefs } = useTaskDefinitions();
    const { assignments, setAssignments, loading: loadingAsg, error: errorAsg } =
        useTaskAssignments();

    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);

    // Modales de definicion
    const [defModalOpen, setDefModalOpen] = useState(false);
    const [editingDef, setEditingDef] = useState(null);
    const [viewingDef, setViewingDef] = useState(null);

    // Modales de asignacion
    const [asgModalOpen, setAsgModalOpen] = useState(false);
    const [asgScope, setAsgScope] = useState(null); // 'user' | 'group' | null
    const [editingAsg, setEditingAsg] = useState(null);
    const [viewingAsg, setViewingAsg] = useState(null);

    // Panel de asignaciones de una definicion
    const [panelDef, setPanelDef] = useState(null);

    useEffect(() => {
        getUsers().then(setUsers).catch(() => setUsers([]));
        getGroups().then(setGroups).catch(() => setGroups([]));
    }, []);

    // ---- Handlers de definicion ----
    const onDefSaved = (saved, isEdit) => {
        if (isEdit) setDefinitions((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
        else setDefinitions((prev) => [...prev, saved]);
    };
    const onDefDeleted = (id) => {
        setDefinitions((prev) => prev.filter((d) => d.id !== id));
    };

    // ---- Handlers de asignacion ----
    const onAsgSaved = (saved, isEdit) => {
        if (isEdit) setAssignments((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
        else setAssignments((prev) => [...prev, saved]);
    };
    const onAsgDeleted = (id) => {
        setAssignments((prev) => prev.filter((a) => a.id !== id));
    };

    const loading = effectiveView === "assignments" ? loadingAsg : loadingDefs;

    if (loading)
        return (
            <div className="h-full flex items-center justify-center py-12">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );

    if (errorAsg)
        return (
            <div className="h-full flex items-center justify-center py-12">
                <div className="flex items-center gap-3 bg-text-secondary border border-text-secondary text-text-inverse rounded-lg px-6 py-4 max-w-md">
                    <span className="text-h1"><CloudAlert /></span>
                    <div>
                        <p className="font-heading">Error al cargar Tareas</p>
                        <p className="text-small">{errorAsg.message}</p>
                    </div>
                </div>
            </div>
        );

    // Columnas segun vista
    const asgCols = assignmentColumns({
        onView: setViewingAsg,
        onEdit: setEditingAsg,
        onDeleted: onAsgDeleted,
        canEdit: canEditAssignment,
        canDelete: canDeleteAssignment,
    });

    const defCols = definitionColumns({
        onView: setViewingDef,
        onEdit: setEditingDef,
        onDeleted: onDefDeleted,
        onManage: setPanelDef,
        canEdit: canEditDefinition,
        canDelete: canDeleteDefinition,
    });

    return (
        <div className="flex flex-col gap-4">

            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-h2 text-text-primary font-heading">Tareas</h2>
                <div className="flex gap-3">
                    {effectiveView === "assignments" ? (
                        <>
                            {canCreateAssignment && (
                                <Button className="flex gap-2" onClick={() => { setAsgScope("user"); setAsgModalOpen(true); }} variant="soft" icon={Plus}>
                                    Asignar a usuario
                                </Button>
                            )}
                            {canCreateAssignment && (
                                <Button className="flex gap-2" onClick={() => { setAsgScope("group"); setAsgModalOpen(true); }} variant="soft" icon={Plus}>
                                    Asignar a grupo
                                </Button>
                            )}
                        </>
                    ) : (
                        canCreateDefinition && (
                            <Button className="flex gap-2" onClick={() => setDefModalOpen(true)} variant="soft" icon={Plus}>
                                Crear tarea
                            </Button>
                        )
                    )}
                    <Button
                        data={effectiveView === "assignments" ? assignments : definitions}
                        reportConfig={
                            effectiveView === "assignments"
                                ? tasksAssignmentsReportConfig
                                : tasksDefinitionsReportConfig
                        }
                        variant="primary"
                        icon={Download}
                    >
                        Descargar Reporte
                    </Button>
                </div>
            </div>

            {/* Toggle de vista (solo si hay permiso para ambas) */}
            {showToggle && (
            <div className="inline-flex self-start rounded-[var(--radius-lg)] border border-border overflow-hidden">
                <button
                    type="button"
                    onClick={() => setView("assignments")}
                    className={
                        "px-4 py-2 text-small font-medium flex items-center gap-2 transition-colors " +
                        (view === "assignments"
                            ? "bg-brand text-text-inverse"
                            : "bg-surface-hover text-text-secondary hover:bg-surface-hover")
                    }
                >
                    <ClipboardList size={14} />
                    Asignaciones
                </button>
                <button
                    type="button"
                    onClick={() => setView("definitions")}
                    className={
                        "px-4 py-2 text-small font-medium flex items-center gap-2 transition-colors border-l border-border " +
                        (view === "definitions"
                            ? "bg-brand text-text-inverse"
                            : "bg-surface-hover text-text-secondary hover:bg-surface-hover")
                    }
                >
                    <ListChecks size={14} />
                    Tareas (definiciones)
                </button>
            </div>
            )}

            {/* Tabla */}
            {effectiveView === "assignments" ? (
                <DataTable
                    data={assignments}
                    columns={asgCols}
                    onRowDoubleClick={(row) => setViewingAsg(row)}
                />
            ) : (
                <DataTable
                    data={definitions}
                    columns={defCols}
                    onRowDoubleClick={(row) => setPanelDef(row)}
                />
            )}

            {/* Modales de definicion */}
            <TaskDefinitionModal
                isOpen={defModalOpen}
                onClose={() => setDefModalOpen(false)}
                onSaved={onDefSaved}
                definition={null}
            />
            <TaskDefinitionModal
                isOpen={Boolean(editingDef)}
                onClose={() => setEditingDef(null)}
                onSaved={onDefSaved}
                definition={editingDef}
            />
            <TaskDefinitionModal
                isOpen={Boolean(viewingDef)}
                onClose={() => setViewingDef(null)}
                definition={viewingDef}
                readOnly
            />

            {/* Modales de asignacion (lista general) */}
            <TaskAssignmentModal
                isOpen={asgModalOpen}
                onClose={() => { setAsgModalOpen(false); setAsgScope(null); }}
                onSaved={(saved) => { onAsgSaved(saved, false); setAsgModalOpen(false); setAsgScope(null); }}
                definitions={definitions}
                users={users}
                groups={groups}
                prefillScope={asgScope}
            />
            <TaskAssignmentModal
                isOpen={Boolean(editingAsg)}
                onClose={() => setEditingAsg(null)}
                onSaved={onAsgSaved}
                assignment={editingAsg}
                definitions={definitions}
                users={users}
                groups={groups}
            />
            <TaskAssignmentModal
                isOpen={Boolean(viewingAsg)}
                onClose={() => setViewingAsg(null)}
                assignment={viewingAsg}
                definitions={definitions}
                users={users}
                groups={groups}
                readOnly
            />

            {/* Panel de asignaciones de una definicion */}
            <TaskAssignmentsPanel
                isOpen={Boolean(panelDef)}
                onClose={() => setPanelDef(null)}
                definition={panelDef}
                users={users}
                groups={groups}
            />
        </div>
    );
}
