import { ActiveSwitch, promptAlert, StatusBadge, usePermissions } from "@/shared";
import { toggleUserActive } from "@/features/users/services/userService"; // ajusta la ruta segun tu estructura real
import UserRowActions from "@/features/users/components/list/UserRowActions"; // ajusta la ruta segun tu estructura real

function UserActiveSwitch({ user, onToggled }) {
    const { isSuper, can } = usePermissions();

    const requestDeactivationReason = async (nextIsActive) => {
        if (nextIsActive) return undefined;

        const result = await promptAlert({
            icon: "warning",
            iconColor: "var(--color-warning)",
            title: "Motivo de inactivación",
            text: "Indique el motivo para deshabilitar esta cuenta de usuario.",
            inputLabel: "Motivo de inactivación",
            inputPlaceholder: "Describa el motivo de la inactivación",
            confirmText: "Deshabilitar",
            cancelText: "Cancelar",
            inputValidator: (value) => value.trim().length < 10
                ? "El motivo debe tener al menos 10 caracteres."
                : "",
        });

        return result.isConfirmed
            ? { deactivationReason: result.value.trim() }
            : false;
    };

    // Sin edit_user, el backend rechazaría el PATCH — mostrar el estado como
    // solo lectura en vez de un switch que siempre terminaría en un 403.
    if (!isSuper && !can("edit_user")) {
        return <StatusBadge active={user.is_active} />;
    }

    return (
        <ActiveSwitch
            id={user.id}
            isActive={user.is_active}
            toggleFn={toggleUserActive}
            entity="usuario"
            beforeToggle={requestDeactivationReason}
            onToggled={onToggled}
        />
    );
}

export const getUserColumns = (onDeleted) => [
    {
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        id: "nombre",
        header: "Nombre",
    },
    {
        accessorFn: (row) => row.groups && row.groups.length > 0
            ? row.groups.map(g => g.name).join(", ")
            : "Sin grupo",
        id: "groups",
        header: "Grupo",
        meta: { filterVariant: "select" },
    },
    {
        accessorFn: (row) => row.document_type?.name ?? "Sin tipo de documento",
        id: "document_type",
        header: "Tipo de Documento",
        meta: { filterVariant: "select" },
    },
    {
        accessorKey: "document_number",
        header: "Numero de Documento",
    },
    {
        accessorKey: "email",
        header: "Correo",
    },
    {
        accessorKey: "phone_number",
        header: "Teléfono",
    },
    {
        accessorFn: (row) => row.is_active ? "Activo" : "Inactivo",
        id: "is_active",
        header: "Estado",
        meta: { filterVariant: "select" },
        cell: ({ row }) => <UserActiveSwitch user={row.original} onToggled={onDeleted} />,
    },
    {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
            <UserRowActions user={row.original} onDeleted={onDeleted} />
        ),
    },
];
