import { Tab } from '@headlessui/react';
import  TmHomePage  from "../../features/trademarks/pages/TmHomePage";
import {AccessPage} from "@/features/access"
import GroupManagement from "../../features/access/components/GroupManagement";
import { ProfileEditPage } from "@/features/users";
import { CategoryHomePage } from "@/features/categories";
import { usePermissions } from "@/shared/hooks/usePermissions";

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Pestanas que cualquier usuario autenticado puede ver.
// Tareas e Inventarios viven ahora en el sidebar con rutas propias.
const BASE_TABS = [
    { id: "profile",  label: "Editar Perfil",     panel: <ProfileEditPage /> },
    { id: "brands",   label: "Marcas",            panel: <TmHomePage />        },
    { id: "access",   label: "Roles y Permisos",  panel: <AccessPage />        },
    { id: "groups",   label: "Grupos",            panel: <GroupManagement />   },
];

// Pestana adicional reservada a administradores / usuarios con permiso
// explicito (codename `view_category`).
const CATEGORY_TAB = {
    id: "categories",
    label: "Categorias",
    panel: <CategoryHomePage />,
};

// Construye la lista de tabs visibles segun permisos.
function buildTabs(canSeeCategories) {
    // BASE_TABS tiene 4 items (indices 0..3). Inyectamos Categorias
    // despues del tab "brands" (indice 1) para mantener un orden logico.
    return canSeeCategories
        ? [...BASE_TABS.slice(0, 2), CATEGORY_TAB, ...BASE_TABS.slice(2)]
        : [...BASE_TABS];
}

export default function TabBar() {
    const { isSuper, can } = usePermissions();
    const canSeeCategories  = isSuper || can("view_category");

    const tabs = buildTabs(canSeeCategories);

    // El grid se ajusta dinamicamente al numero de tabs visibles para que
    // el ancho se reparta de forma pareja (4 o 5 columnas).
    const cols = tabs.length;

    return (
        <div className="w-full">
            <Tab.Group>
                <Tab.List
                    className={`grid border-b border-border`}
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

                <Tab.Panels className="mt-6">
                    {tabs.map((tab) => (
                        <Tab.Panel key={tab.id}>{tab.panel}</Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
        </div>
    );
}
