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

// Pestanas base.
// - Editar Perfil: cualquier autenticado.
// - Marcas: requiere view_brand (el backend lo exige para listar).
// - Roles y Permisos / Grupos: las mutaciones del backend exigen
//   superusuario (IsSuperUser), así que solo se muestran a superusuarios.
const BASE_TABS = [
    { id: "profile",  label: "Editar Perfil",     panel: <ProfileEditPage />, perm: [] },
    { id: "brands",   label: "Marcas",            panel: <TmHomePage />,        perm: ["view_brand"] },
    { id: "access",   label: "Roles y Permisos",  panel: <AccessPage />,        superOnly: true },
    { id: "groups",   label: "Grupos",            panel: <GroupManagement />,   superOnly: true },
];

// Pestana adicional reservada a administradores / usuarios con permiso
// explicito (codename `view_category`).
const CATEGORY_TAB = {
    id: "categories",
    label: "Categorias",
    panel: <CategoryHomePage />,
};

// Construye la lista de tabs visibles segun permisos.
function buildTabs({ isSuper, can }) {
    const visible = BASE_TABS.filter((tab) => {
        if (tab.superOnly) return isSuper;
        if (tab.perm?.length) return isSuper || tab.perm.some((c) => can(c));
        return true;
    });
    // Inyectamos Categorias despues del tab "brands" para mantener un orden logico.
    if (isSuper || can("view_category")) {
        const idx = visible.findIndex((t) => t.id === "brands");
        const at = idx >= 0 ? idx + 1 : visible.length;
        visible.splice(at, 0, CATEGORY_TAB);
    }
    return visible;
}

export default function TabBar() {
    const { isSuper, can } = usePermissions();

    const tabs = buildTabs({ isSuper, can });

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
