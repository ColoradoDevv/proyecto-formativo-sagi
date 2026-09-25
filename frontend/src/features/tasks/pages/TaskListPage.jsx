import { useState, useEffect } from "react";
import { Button, DataTable, MODULE_PERMS, usePermissions } from "@/shared";
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
import SubmitTaskModal from "../components/SubmitTaskModal";
import { tasksAssignmentsReportConfig, tasksDefinitionsReportConfig } from "../reports/tasksReportConfig";

// Pagina principal de tareas.
// Toggle entre dos vistas:
//   - "assignments": una fila por asignacion (usuario o grupo <-> tarea con su estado).
//   - "definitions": una fila por definicion de tarea, con acceso al panel
//     de asignaciones de esa definicion.
export default function TaskListPage() {
    const { can, canAny } = usePermissions();
    const canEditAssignment   = can("edit_task_assignment");
    const canDeleteAssignment = can("delete_task_assignment");
    const canDeleteDefinition = can("delete_task");
    const canCreateAssignment = can("create_task_assignment");
    const canCreateDefinition = can("create_task");
    const canEditDefinition   = can("edit_task");
    // Gestionar asignaciones de una definición (ver las de todos) exige el
    // código global; sin él no se ofrece el panel ni el doble-click lo abre.
    const canManageAssignments = can("view_task_assignment");
    // Sin view_task_assignment global, el listado se limita a "las mías"
    // (propias + las de mis grupos) vía ?scope=mine, que el backend permite
    // sin el código. Así funciona por grupo, no solo por usuario suelto.
    const canViewAllAsg = can("view_task_assignment");
    // La vista de definiciones exige view_task en el backend; las
    // asignaciones propias las puede ver cualquiera (el backend lo permite
    // con ?scope=user&user=<yo>), así que "Mis tareas" es la entrada
    // por defecto para todos.
    const canViewDefs = can("view_task");

    // Vista administrativa vs. vista normal: solo quien gestiona (ver todo,
    // crear, editar o borrar) ve el toggle, destinatarios y botones de
    // gestión. El asignado ve "Mis tareas": solo lo suyo, simple.
    const isTaskManager =
        canViewAllAsg || canCreateAssignment || canCreateDefinition ||
        canEditAssignment || canDeleteAssignment || canEditDefinition || canDeleteDefinition;

    const [view, setView] = useState("assignments");
    const showToggle = isTaskManager && canViewDefs;
    // Vista efectiva: definiciones solo en modo gestión con permiso.
    const effectiveView = isTaskManager && view === "definitions" && canViewDefs ? "definitions" : "assignments";
    // Reporte por vista (definiciones o asignaciones, cada uno con su código).
    const canExport = canAny(effectiveView === "definitions" ? ["export_tasks"] : ["export_task_assignments"]);

    const { definitions, setDefinitions, loading: loadingDefs } = useTaskDefinitions();
    const { assignments, setAssignments, loading: loadingAsg, error: errorAsg } =
        useTaskAssignments(canViewAllAsg ? {} : { scope: "mine" });

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

    // Entrega de tarea por el asignado (pasa a "En revisión")
    const [finishingAsg, setFinishingAsg] = useState(null);
    const onAsgSubmitted = (updated) => {
        setAssignments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
        setFinishingAsg(null);
    };

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
        onFinish: setFinishingAsg,
        onDeleted: onAsgDeleted,
        canEdit: canEditAssignment,
        canDelete: canDeleteAssignment,
        canFinish: true,
    });

    // Vista normal del asignado: sin Tipo/Destinatario ni gestión.
    const myTaskCols = assignmentColumns({
        onView: setViewingAsg,
        onEdit: undefined,
        onFinish: setFinishingAsg,
        onDeleted: onAsgDeleted,
        canEdit: false,
        canDelete: false,
        canFinish: true,
        simple: true,
    });

    const defCols = definitionColumns({
        onView: setViewingDef,
        onEdit: setEditingDef,
        onDeleted: onDefDeleted,
        onManage: canManageAssignments ? setPanelDef : undefined,
        canEdit: canEditDefinition,
        canDelete: canDeleteDefinition,
    });

    return (
        <div className="flex flex-col gap-4">

            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-h2 text-text-primary font-heading">
                    {isTaskManager ? "Tareas" : "Mis tareas"}
                </h2>
                {isTaskManager && (
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
                    {canExport && (
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
                    )}
                </div>
                )}
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
                            ? "bg-brand text-on-brand"
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
                            ? "bg-brand text-on-brand"
                            : "bg-surface-hover text-text-secondary hover:bg-surface-hover")
                    }
                >
                    <ListChecks size={14} />
                    Tareas (definiciones)
                </button>
            </div>
            )}

            {/* Tabla: doble-click abre visualización (como el resto de módulos) */}
            {effectiveView === "assignments" ? (
                <DataTable
                    data={assignments}
                    columns={isTaskManager ? asgCols : myTaskCols}
                    onRowDoubleClick={(row) => setViewingAsg(row)}
                />
            ) : (
                <DataTable
                    data={definitions}
                    columns={defCols}
                    onRowDoubleClick={(row) => setViewingDef(row)}
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

            {/* Entrega de tarea por el asignado */}
            <SubmitTaskModal
                isOpen={Boolean(finishingAsg)}
                onClose={() => setFinishingAsg(null)}
                assignment={finishingAsg}
                onSubmitted={onAsgSubmitted}
            />
        </div>
    );
}
