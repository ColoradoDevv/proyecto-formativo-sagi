import { Tab } from '@headlessui/react';
import  TmHomePage  from "../../features/trademarks/pages/TmHomePage";
import {AccessPage} from "@/features/access"
import GroupManagement from "../../features/access/components/GroupManagement";
import { TaskHomePage } from "@/features/tasks"
import { ProfileEditPage } from "@/features/users";
import { InventoryHomePage } from "@/features/inventories";
import { CategoryHomePage } from "@/features/categories";
import { usePermissions } from "@/shared/hooks/usePermissions";

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Pestanas que cualquier usuario autenticado puede ver.
const BASE_TABS = [
    { id: "profile",  label: "Editar Perfil",     panel: <ProfileEditPage /> },
    { id: "brands",   label: "Marcas",            panel: <TmHomePage />        },
    { id: "access",   label: "Roles y Permisos",  panel: <AccessPage />        },
    { id: "groups",   label: "Grupos",            panel: <GroupManagement />   },
    { id: "tasks",    label: "Tareas",            panel: <TaskHomePage />      },
];

// Pestanas adicionales reservadas a administradores / usuarios con permiso
// explicito (codenames `view_inventory`, `view_category`).
const INVENTORY_TAB = {
    id: "inventories",
    label: "Inventarios",
    panel: <InventoryHomePage />,
};
const CATEGORY_TAB = {
    id: "categories",
    label: "Categorias",
    panel: <CategoryHomePage />,
};

// Construye la lista de tabs visibles segun permisos:
//   - Inventarios y Categorias cuelgan de Marcas (solo si tienen permiso).
function buildTabs(canSeeInventories, canSeeCategories) {
    const extras = [];
    if (canSeeInventories) extras.push(INVENTORY_TAB);
    if (canSeeCategories) extras.push(CATEGORY_TAB);
    // BASE_TABS tiene 5 items (indices 0..4). Inyectamos los extras
    // despues del tab "brands" (indice 1) para mantener un orden logico.
    return [...BASE_TABS.slice(0, 2), ...extras, ...BASE_TABS.slice(2)];
}

export default function TabBar() {
    const { isSuper, can } = usePermissions();
    const canSeeInventories = isSuper || can("view_inventory");
    const canSeeCategories  = isSuper || can("view_category");

    const tabs = buildTabs(canSeeInventories, canSeeCategories);

    // El grid se ajusta dinamicamente al numero de tabs visibles para que
    // el ancho se reparta de forma pareja (5, 6 o 7 columnas).
    const cols = tabs.length;

    return (
        <div className="w-full pt-4 sm:pt-6">
            <Tab.Group>
                <Tab.List
                    className={`grid border-b border-border px-4 sm:px-6`}
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.id}
                            className={({ selected }) =>
                                classNames(
                                    'flex-1 pb-3 text-primary font-medium text-center outline-none transition-all cursor-pointer duration-(--duration-base)',
                                    selected
                                        ? 'border-b-2 border-brand text-text-primary'
                                        : 'border-b-2 border-transparent text-text-muted hover:border-border-strong hover:text-text-secondary'
                                )
                            }
                        >
                            {tab.label}
                        </Tab>
                    ))}
                </Tab.List>

                <Tab.Panels className="mt-6 px-4 sm:px-6">
                    {tabs.map((tab) => (
                        <Tab.Panel key={tab.id}>{tab.panel}</Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
        </div>
    );
}
