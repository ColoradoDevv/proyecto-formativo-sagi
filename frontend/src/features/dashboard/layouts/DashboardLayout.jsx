import { useEffect, useState } from "react"
import AccessCards from "../components/AccessCards"
import QuickActions from "../components/QuickActions"
import RecentActivity from "../components/RecentActivity"
import { Wrench, Package, ClipboardList, UserRound } from "lucide-react"
import { getDashboardSummary } from "@/features/loans/services/loanService";
import { usePermissions } from "@/shared/hooks/usePermissions"

export default function DashboardLayout() {
    const { canAny, user } = usePermissions()

    // Permisos reales en BD (0002) + codenames nuevos (0004)
    const canSeeUsers       = canAny(["list_users", "view_user"])
    const canSeeConsumables = canAny(["list_consumable_materials", "view_consumable_material", "view_consumable"])
    const canSeeReturnables = canAny(["list_returnable_materials", "view_returnable_material", "view_returnable"])
    const canSeeLoans       = canAny(["list_loans", "view_loan"])

    const [userCount,       setUserCount]       = useState(0)
    const [consumableCount, setConsumableCount] = useState(0)
    const [returnableCount, setReturnableCount] = useState(0)
    const [loansCount,      setLoansCount]      = useState(0)

    const [userError,       setUserError]       = useState(false)
    const [consumableError, setConsumableError] = useState(false)
    const [returnableError, setReturnableError] = useState(false)
    const [loansError,      setLoansError]      = useState(false)

    useEffect(() => {
        // Un solo round-trip: el backend devuelve solo los contadores de
        // los módulos que el usuario puede ver (4 COUNT en ~250ms en vez
        // de 4 listados completos de ~1s).
        const controller = new AbortController();
        getDashboardSummary(controller.signal)
            .then((data) => {
                setUserCount(data.users ?? 0);
                setConsumableCount(data.consumables ?? 0);
                setReturnableCount(data.returnables ?? 0);
                setLoansCount(data.loans ?? 0);
                setUserError(false);
                setConsumableError(false);
                setReturnableError(false);
                setLoansError(false);
            })
            .catch((err) => {
                if (err?.name === "AbortError" || err?.silent) return;
                setUserError(true);
                setConsumableError(true);
                setReturnableError(true);
                setLoansError(true);
            });
        return () => controller.abort();
    }, [])

    const userName = user?.first_name

    const now = new Date()
    const formattedDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`
    const hour = now.getHours()
    const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

    const cards = []
    if (canSeeUsers) {
        cards.push({
            label: "Usuarios registrados",
            Icon: <UserRound />,
            value: userCount,
            hasError: userError,
            to: "/usuarios",
        })
    }
    if (canSeeConsumables) {
        cards.push({
            label: "Materiales consumibles",
            Icon: <Wrench />,
            value: consumableCount,
            hasError: consumableError,
            to: "/consumibles",
        })
    }
    if (canSeeReturnables) {
        cards.push({
            label: "Materiales devolutivos",
            Icon: <Package />,
            value: returnableCount,
            hasError: returnableError,
            to: "/devolutivos",
        })
    }
    if (canSeeLoans) {
        cards.push({
            label: "Préstamos registrados",
            Icon: <ClipboardList />,
            value: loansCount,
            hasError: loansError,
            to: "/prestamos",
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <p className="text-text-primary uppercase tracking-widest text-small">
                    Panel de control / {formattedDate}
                </p>
                <h2 className="text-h2 text-text-primary font-heading">
                    {greeting}, {userName}.
                </h2>
                <p className="text-body text-text-secondary">
                    Bienvenido a SAGI. Aquí tienes un resumen de tu operación.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, index) => (
                    <AccessCards
                        key={card.to}
                        Icon={card.Icon}
                        label={card.label}
                        value={card.value}
                        hasError={card.hasError}
                        to={card.to}
                        style={{ animationDelay: `${index * 60}ms` }}
                    />
                ))}
            </div>

            <QuickActions />
            <RecentActivity />
        </div>
    )
}
