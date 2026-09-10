import { usePermissions } from "@/shared/hooks/usePermissions";
import { Plus, UserRound, Wrench, Package, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

// Accesos rapidos a las acciones de creacion mas frecuentes.
// Cada acción solo se muestra si el usuario tiene al menos uno de los permisos listados.
const ALL_ACTIONS = [
    {
        label: "Registrar usuario",
        to: "/usuarios/crear",
        Icon: UserRound,
        requiredPerms: ["create_user"],
    },
    {
        label: "Registrar consumible",
        to: "/consumibles/crear",
        // Codenames reales en BD (migración 0002) + codenames nuevos (migración 0004)
        Icon: Wrench,
        requiredPerms: ["create_consumable_material", "create_consumable"],
    },
    {
        label: "Registrar devolutivo",
        to: "/devolutivos/crear",
        Icon: Package,
        requiredPerms: ["create_returnable_material", "create_returnable"],
    },
    {
        label: "Registrar préstamo",
        to: "/prestamos/crear",
        Icon: ClipboardList,
        requiredPerms: ["create_loan"],
    },
];

export default function QuickActions() {
    const { canAny } = usePermissions();

    const visibleActions = ALL_ACTIONS.filter(({ requiredPerms }) =>
        canAny(requiredPerms)
    );

    // No renderizar la sección si el usuario no tiene ninguna acción disponible
    if (visibleActions.length === 0) return null;

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-h3 text-text-primary font-heading">Accesos rápidos</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleActions.map((action, index) => (
                    <Link
                        key={action.to}
                        to={action.to}
                        style={{ animationDelay: `${index * 60}ms` }}
                        className="group flex items-center gap-3 h-[var(--size-control-2xl)] px-3 bg-brand text-text-inverse rounded-[var(--radius-xl)] shadow-(--shadow-elevation-4) hover:shadow-(--shadow-elevation-5) hover:-translate-y-1 transition-all duration-200 cursor-pointer animate-slide-up"
                    >
                        <span className="bg-surface-hover/15 rounded-xl w-9 h-9 flex items-center justify-center shrink-0">
                            <action.Icon size={18} />
                        </span>
                        <span className="font-medium text-body flex-1 truncate">
                            {action.label}
                        </span>
                        <Plus
                            size={20}
                            className="shrink-0 transition-transform duration-300 group-hover:rotate-90"
                        />
                    </Link>
                ))}
            </div>
        </div>
    );
}
