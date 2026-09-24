import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ClipboardList, HandCoins, Inbox } from "lucide-react";
import { usePermissions, MODULE_PERMS } from "@/shared/hooks/usePermissions";
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
// Regla por rol:
//   * SADMIN / ADMIN / INST (o superusuario): últimos 5 préstamos del sistema.
//   * Cualquier otro usuario estándar: sus tareas asignadas (scope=user).
// La campana siempre se muestra para usuarios autenticados.
const LOAN_ROLES = ["SADMIN", "ADMIN", "INST"];

export default function NotificationsBell() {
    const { user, isSuper, canAny } = usePermissions();

    const groups = (user?.groups ?? []).map((g) => String(g).trim().toUpperCase());
    const isLoanRole = isSuper || groups.some((g) => LOAN_ROLES.includes(g));

    // El panel de préstamos exige además el permiso de ver (defensa en
    // profundidad si un grupo personalizado usa esos nombres sin el código).
    const showAdminPanel = isLoanRole && (isSuper || canAny(MODULE_PERMS.loans.view));
    // El pie "Ir a mis tareas" solo si puede entrar al módulo.
    const canEnterTasks = isSuper || canAny(MODULE_PERMS.tasks.view);

    return (
        <NotificationsBellInner
            userId={user?.id}
            isAdminPanel={showAdminPanel}
            canEnterTasks={canEnterTasks}
        />
    );
}

// Implementacion real: solo se monta cuando hay al menos un panel que mostrar,
// para no hacer fetches innecesarios para usuarios sin permisos.
function NotificationsBellInner({ userId, isAdminPanel, canEnterTasks }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const panelRef = useRef(null);

    // Solo uno de estos hooks tendra datos utiles (segun el rol).
    // El otro recibe limit 0 / sin filtros para no hacer fetch.
    // Tareas: ?scope=mine (propias + las de mis grupos, permitido sin código).
    const loansPanel = useRecentLoans(isAdminPanel ? 5 : 0);
    const tasksPanel = useTaskAssignments(
        !isAdminPanel && userId ? { scope: "mine" } : {}
    );

    const panel = isAdminPanel ? loansPanel : tasksPanel;
    const items = isAdminPanel ? loansPanel.loans : tasksPanel.assignments;
    const loading = panel.loading;
    const error = panel.error;
    const reload = panel.reload;
    const count = items?.length ?? 0;

    // "Tiempo real": re-fetch inmediato al abrir + polling mientras esta abierto.
    usePolling(reload, { enabled: open, intervalMs: POLL_INTERVAL_MS });

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
                {count > 0 && (
                    <span className={
                        "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 " +
                        "rounded-full bg-error text-text-inverse text-small font-bold " +
                        "flex items-center justify-center"
                    }>
                        {count > 9 ? "9+" : count}
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
                        <div className="flex items-center gap-2">
                            {isAdminPanel ? <HandCoins size={16} /> : <ClipboardList size={16} />}
                            <span className="text-small font-heading">
                                {isAdminPanel ? "Ultimos prestamos" : "Mis tareas asignadas"}
                            </span>
                        </div>
                        <span className="text-small text-text-muted">
                            {loading ? "Actualizando..." : `${count} ${count === 1 ? "item" : "items"}`}
                        </span>
                    </div>

                    {/* Contenido */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {loading ? (
                            <EmptyState icon={<Inbox size={28} />} text="Cargando..." />
                        ) : error ? (
                            <EmptyState icon={<Inbox size={28} />} text="No se pudieron cargar las notificaciones." />
                        ) : count === 0 ? (
                            <EmptyState
                                icon={<Inbox size={28} />}
                                text={isAdminPanel ? "No hay prestamos recientes." : "No tienes tareas asignadas."}
                            />
                        ) : isAdminPanel ? (
                            <LoansList loans={items} />
                        ) : (
                            <AssignmentsList assignments={items} />
                        )}
                    </div>

                    {/* Pie */}
                    <div className="border-t border-border px-2 py-2">
                        {isAdminPanel ? (
                            <Link
                                to="/prestamos"
                                onClick={() => setOpen(false)}
                                className="block text-center text-small text-brand hover:underline py-1"
                            >
                                Ver todos los prestamos
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
