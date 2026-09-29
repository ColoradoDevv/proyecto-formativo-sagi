import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ClipboardList, HandCoins, Inbox } from "lucide-react";
import { usePermissions, MODULE_PERMS, NOTIFICATION_PERMS } from "@/shared/hooks/usePermissions";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { usePolling } from "@/shared/hooks/usePolling";
import useRecentLoans from "@/features/dashboard/hooks/useRecentLoans";
import useTaskAssignments from "@/features/tasks/hooks/useTaskAssignments";
import TaskStateBadge from "@/features/tasks/components/TaskStateBadge";
import LoanStateBadge from "@/features/loans/components/LoanStateBadge";

// Frecuencia de refresco automatico mientras el panel esta abierto (ms).
// 30s mantiene "tiempo real" sin saturar al backend.
const POLL_INTERVAL_MS = 30000;

// Campana de notificaciones en la navbar.
// Regla por permiso ajustable desde Roles y permisos (sección Notificaciones,
// excluyente: préstamos o tareas, no ambas):
//   * Panel "Últimos préstamos": requiere view_loan_notifications + view_loan
//     del módulo (los datos siguen exigiendo el permiso del módulo).
//   * Panel "Mis tareas": requiere view_task_notifications (?scope=mine no
//     exige código en el backend).
// Con ambos (superusuario) se muestran pestañas; sin ninguno se indica que
// no hay notificaciones habilitadas. La campana siempre se muestra para
// usuarios autenticados.
export default function NotificationsBell() {
    const { user, isSuper, canAny } = usePermissions();

    const hasLoanNotif = isSuper || canAny(NOTIFICATION_PERMS.loans);
    const hasTaskNotif = isSuper || canAny(NOTIFICATION_PERMS.tasks);
    // Puerta del panel de préstamos: permiso de notificación + permiso del
    // módulo que exigen el sidebar, el router y el backend para listar.
    const canViewLoansModule = isSuper || canAny(MODULE_PERMS.loans.view);
    const showLoans = hasLoanNotif && canViewLoansModule;
    const showTasks = hasTaskNotif && !!user?.id;
    // El pie "Ir a mis tareas" solo si puede entrar al módulo.
    const canEnterTasks = isSuper || canAny(MODULE_PERMS.tasks.view);

    return (
        <NotificationsBellInner
            userId={user?.id}
            showLoans={showLoans}
            showTasks={showTasks}
            canEnterTasks={canEnterTasks}
        />
    );
}

// Implementacion real: solo hace fetch de lo que el usuario puede ver,
// para no pedir préstamos sin permiso ni tareas sin sesión.
function NotificationsBellInner({ userId, showLoans, showTasks, canEnterTasks }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("loans"); // "loans" | "tasks"
    const containerRef = useRef(null);
    const panelRef = useRef(null);

    // Préstamos solo con ambos permisos (limit 0 = sin fetch). Tareas propias
    // con su permiso de notificación (?scope=mine no exige código).
    const loansPanel = useRecentLoans(showLoans ? 5 : 0);
    const tasksPanel = useTaskAssignments(
        showTasks && userId ? { scope: "mine" } : {}
    );

    const showTabs = showLoans && showTasks;
    const activeTab = showTabs ? tab : (showLoans ? "loans" : "tasks");
    const panel = activeTab === "loans" ? loansPanel : tasksPanel;
    const items = activeTab === "loans" ? loansPanel.loans : tasksPanel.assignments;
    const loading = panel.loading;
    const error = panel.error;
    const count = items?.length ?? 0;
    // Badge: suma de ambas vistas cuando hay pestañas.
    const badgeCount = showTabs
        ? (loansPanel.loans?.length ?? 0) + (tasksPanel.assignments?.length ?? 0)
        : count;
    const hasAnyPanel = showLoans || showTasks;

    // "Tiempo real": re-fetch inmediato al abrir + polling mientras esta abierto.
    usePolling(loansPanel.reload, { enabled: open && showLoans, intervalMs: POLL_INTERVAL_MS });
    usePolling(tasksPanel.reload, { enabled: open && showTasks, intervalMs: POLL_INTERVAL_MS });

    // Cerrar con click fuera o Escape (logica reutilizable via hook compartido).
    useClickOutside({
        containerRef,
        contentRef: panelRef,
        isActive: open,
        onClose: () => setOpen(false),
    });

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label="Notificaciones"
                aria-expanded={open}
                title="Notificaciones"
                onClick={() => setOpen((v) => !v)}
                className="relative p-1.5 rounded-lg hover:bg-surface-muted transition-colors cursor-pointer text-text-primary"
            >
                <Bell size={22} />
                {badgeCount > 0 && (
                    <span className={
                        "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 " +
                        "rounded-full bg-error text-text-inverse text-small font-bold " +
                        "flex items-center justify-center"
                    }>
                        {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Panel de notificaciones"
                    className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] z-50
                               bg-surface-hover/80 backdrop-blur-[10px]
                               border border-border rounded-[var(--radius-md)]
                               shadow-[var(--shadow-elevation-3)]
                               overflow-hidden"
                >
                    {/* Encabezado */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
                        {showTabs ? (
                            <div className="flex items-center gap-1" role="tablist" aria-label="Notificaciones">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === "loans"}
                                    onClick={() => setTab("loans")}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-small font-heading cursor-pointer transition-colors ${activeTab === "loans" ? "bg-surface-muted text-text-primary" : "text-text-muted hover:text-text-primary"}`}
                                >
                                    <HandCoins size={16} /> Préstamos
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === "tasks"}
                                    onClick={() => setTab("tasks")}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-small font-heading cursor-pointer transition-colors ${activeTab === "tasks" ? "bg-surface-muted text-text-primary" : "text-text-muted hover:text-text-primary"}`}
                                >
                                    <ClipboardList size={16} /> Mis tareas
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {activeTab === "loans" ? <HandCoins size={16} /> : <ClipboardList size={16} />}
                                <span className="text-small font-heading">
                                    {!hasAnyPanel ? "Notificaciones" : activeTab === "loans" ? "Últimos préstamos" : "Mis tareas asignadas"}
                                </span>
                            </div>
                        )}
                        <span className="text-small text-text-muted">
                            {loading ? "Actualizando..." : `${count} ${count === 1 ? "item" : "items"}`}
                        </span>
                    </div>

                    {/* Contenido */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {!hasAnyPanel ? (
                            <EmptyState icon={<Inbox size={28} />} text="No tienes notificaciones habilitadas." />
                        ) : loading ? (
                            <EmptyState icon={<Inbox size={28} />} text="Cargando..." />
                        ) : error ? (
                            <EmptyState icon={<Inbox size={28} />} text="No se pudieron cargar las notificaciones." />
                        ) : count === 0 ? (
                            <EmptyState
                                icon={<Inbox size={28} />}
                                text={activeTab === "loans" ? "No hay préstamos recientes." : "No tienes tareas asignadas."}
                            />
                        ) : activeTab === "loans" ? (
                            <LoansList loans={items} />
                        ) : (
                            <AssignmentsList assignments={items} />
                        )}
                    </div>

                    {/* Pie */}
                    <div className="border-t border-border px-2 py-2">
                        {!hasAnyPanel ? null : activeTab === "loans" ? (
                            <Link
                                to="/prestamos"
                                onClick={() => setOpen(false)}
                                className="block text-center text-small text-brand hover:underline py-1"
                            >
                                Ver todos los préstamos
                            </Link>
                        ) : (
                            canEnterTasks && (
                                <Link
                                    to="/tareas"
                                    onClick={() => setOpen(false)}
                                    className="block text-center text-small text-brand hover:underline py-1"
                                >
                                    Ir a mis tareas
                                </Link>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-muted">
            {icon}
            <p className="text-small">{text}</p>
        </div>
    );
}

function LoansList({ loans }) {
    return (
        <ul className="divide-y divide-border">
            {loans.map((loan) => {
                const id = loan.id_loan ?? loan.id;
                return (
                    <li key={id}>
                        <Link
                            to={`/prestamos/visualizar/${id}`}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted transition-colors"
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="text-small text-text-primary truncate font-medium">
                                    {loan.material || loan.material_name || `Prestamo #${id}`}
                                </span>
                                <span className="text-small text-text-muted truncate">
                                    {loan.responsable_name || loan.responsable || ""}
                                    {loan.loan_date ? ` - ${loan.loan_date}` : ""}
                                </span>
                            </div>
                            <LoanStateBadge state={loan.state} />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

function AssignmentsList({ assignments }) {
    return (
        <ul className="divide-y divide-border">
            {assignments.map((a) => (
                <li key={a.id}>
                        <Link
                            to="/tareas"
                            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted transition-colors"
                        >
                        <div className="flex flex-col min-w-0">
                            <span className="text-small text-text-primary truncate font-medium">
                                {a.task_name || `Tarea #${a.id}`}
                            </span>
                            <span className="text-small text-text-muted truncate">
                                {a.start_date && a.end_date ? `${a.start_date} - ${a.end_date}` : ""}
                            </span>
                        </div>
                        <TaskStateBadge state={a.state} />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
