import { Link } from "react-router-dom";
import { TailChase } from "ldrs/react";
import { ArrowRight, CloudAlert, ClipboardList, Lock, Package } from "lucide-react";
import LoanStateBadge from "@/features/loans/components/LoanStateBadge";
import { usePermissions } from "@/shared/hooks/usePermissions";
import useRecentLoans from "../hooks/useRecentLoans";

// Resumen de los ultimos prestamos registrados para el panel de inicio.
// Solo se renderiza si el usuario tiene permiso de ver préstamos.
export default function RecentActivity() {
    const { canAny } = usePermissions();

    // Codenames reales de BD (0002) + codenames nuevos (0004)
    const canViewLoans = canAny(["view_loan", "list_loans"]);

    const { loans, loading, error } = useRecentLoans(canViewLoans ? 4 : 0);

    return (
        <div className="bg-surface-hover rounded-2xl shadow-(--shadow-elevation-4) p-6 flex flex-col gap-4 border border-border animate-fade-in">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-medium text-text-primary uppercase tracking-widest font-medium">
                        Registro
                    </p>
                    <h3 className="text-h3 text-text-primary font-heading">
                        Actividad reciente
                    </h3>
                </div>
                {canViewLoans && (
                    <Link
                        to="/prestamos"
                        className="inline-flex items-center gap-1 text-small text-text-secondary hover:text-text-primary transition-colors shrink-0"
                    >
                        Ver todo <ArrowRight size={16} />
                    </Link>
                )}
            </div>

            {!canViewLoans ? (
                <div className="flex items-center gap-3 text-text-muted px-4 py-6">
                    <Lock size={20} />
                    <p className="text-small">No tienes permiso para ver la actividad reciente.</p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-10">
                    <TailChase size="32" speed="1.75" color="var(--semantic-text-primary)" />
                </div>
            ) : error ? (
                <div className="flex items-center gap-3 text-text-secondary px-4 py-6">
                    <span className="text-h2"><CloudAlert /></span>
                    <div>
                        <p className="font-heading">No se pudo cargar la actividad</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            ) : loans.length === 0 ? (
                <div className="bg-[var(--color-secondary-100)] rounded-2xl border-2 border-dashed border-[var(--color-secondary-400)] py-12 px-6 flex flex-col items-center gap-3">
                    <span className="bg-surface-hover rounded-full w-14 h-14 flex items-center justify-center shadow-(--shadow-elevation-1)">
                        <Package size={22} className="text-text-primary" />
                    </span>
                    <p className="text-medium font-medium text-text-primary">
                        Aún no hay préstamos registrados.
                    </p>
                    <p className="text-small text-text-secondary text-center">
                        Cuando registres una actividad, aparecerá aquí.
                    </p>
                </div>
            ) : (
                <ul className="flex flex-col">
                    {loans.map((loan) => (
                        <li
                            key={loan.id_loan}
                            className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-b-0"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-text-secondary shrink-0"><ClipboardList size={18} /></span>
                                <div className="min-w-0">
                                    <p className="text-medium text-text-primary truncate">
                                        {loan.usuario_responsable} prestó a {loan.usuario_receptor}
                                    </p>
                                    <p className="text-small text-text-muted truncate">
                                        {loan.material} · {loan.amount_lent} und.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-small text-text-muted hidden sm:inline">
                                    {loan.loan_date}
                                </span>
                                <LoanStateBadge state={loan.state} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
