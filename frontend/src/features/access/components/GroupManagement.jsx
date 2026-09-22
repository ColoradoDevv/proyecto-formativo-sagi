import { useEffect, useState } from "react";
import { CloudAlert, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { TailChase } from "ldrs/react";
import "ldrs/react/TailChase.css";
import { Button, DataTable, IconButton, Input, Modal, Switch, showAlert, cancelAlert } from "@/shared";
import { createGroup, deleteGroup, getGroups, toggleGroupActive, updateGroup } from "../services/groupService";

const EMPTY_FORM = { name: "", description: "" };

export default function GroupManagement({ onChanged }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [modalMode, setModalMode] = useState("create");
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadGroups = async () => {
        try {
            setLoading(true);
            setGroups((await getGroups()).filter((group) => group.name?.toUpperCase() !== "SADMIN"));
            setError(null);
        } catch (error) {
            setError(error);
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudieron cargar los grupos", text: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadGroups(); }, []);

    const openCreate = () => {
        setEditingGroup(null);
        setForm(EMPTY_FORM);
        setModalMode("create");
        setModalOpen(true);
    };

    const openEdit = (group) => {
        setEditingGroup(group);
        setForm({ name: group.name, description: group.description ?? "" });
        setModalMode("edit");
        setModalOpen(true);
    };

    const openView = (group) => {
        setEditingGroup(group);
        setForm({ name: group.name, description: group.description ?? "" });
        setModalMode("view");
        setModalOpen(true);
    };

    const handleSave = async () => {
        const name = form.name.trim();
        if (name.length < 3) {
            showAlert({ icon: "warning", iconColor: "var(--color-warning)", title: "Nombre inválido", text: "El nombre del grupo debe tener al menos 3 caracteres." });
            return;
        }

        setSaving(true);
        try {
            const payload = { name, description: form.description.trim() };
            const saved = modalMode === "edit"
                ? await updateGroup(editingGroup.id, payload)
                : await createGroup(payload);

            setGroups((previous) => modalMode === "edit"
                ? previous.map((group) => group.id === editingGroup.id ? { ...group, ...saved } : group)
                : [...previous, saved].sort((a, b) => a.name.localeCompare(b.name, "es"))
            );
            setModalOpen(false);
            onChanged?.();
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: modalMode === "edit" ? "Grupo actualizado" : "Grupo creado correctamente" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo guardar el grupo", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (group, isActive) => {
        const result = await cancelAlert({
            title: isActive ? "¿Activar grupo?" : "¿Desactivar grupo?",
            text: isActive
                ? `El grupo ${group.name} volverá a estar disponible para asignar usuarios.`
                : `El grupo ${group.name} dejará de estar disponible para nuevas asignaciones.`,
            confirmText: isActive ? "Sí, activar" : "Sí, desactivar",
            cancelText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            const updated = await toggleGroupActive(group.id, isActive);
            setGroups((previous) => previous.map((item) => item.id === group.id
                ? { ...item, is_active: updated.is_active }
                : item
            ));
            onChanged?.();
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: updated.message });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo actualizar el grupo", text: error.message });
        }
    };

    const handleDelete = async (group) => {
        const result = await cancelAlert({
            title: "¿Eliminar grupo?",
            text: `El grupo ${group.name} será eliminado permanentemente.`,
            confirmText: "Sí, eliminar",
            cancelText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteGroup(group.id);
            setGroups((previous) => previous.filter((item) => item.id !== group.id));
            onChanged?.();
            showAlert({ icon: "success", iconColor: "var(--color-success)", title: "Grupo eliminado correctamente" });
        } catch (error) {
            showAlert({ icon: "error", iconColor: "var(--color-error)", title: "No se pudo eliminar el grupo", text: error.message });
        }
    };

    const columns = [
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "description", header: "Descripción" },
        { accessorKey: "permission_count", header: "Permisos" },
        {
            accessorFn: (row) => row.is_active ? "Activo" : "Inactivo",
            id: "is_active",
            header: "Estado",
            meta: { filterVariant: "select" },
            cell: ({ row }) => (
                <div className="flex min-h-[var(--size-control-md)] items-center gap-2">
                    <Switch
                        checked={row.original.is_active}
                        className="inline-flex shrink-0"
                        onChange={(value) => handleToggle(row.original, value)}
                    />
                </div>
            ),
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <IconButton ariaLabel={`Visualizar grupo ${row.original.name}`} variant="ghost" hitSize={32} iconSize={16} onClick={() => openView(row.original)}>
                        <Eye size={16} />
                    </IconButton>
                    <IconButton ariaLabel={`Editar grupo ${row.original.name}`} variant="ghost" hitSize={32} iconSize={16} onClick={() => openEdit(row.original)}>
                        <Pencil size={16} />
                    </IconButton>
                    <IconButton ariaLabel={`Eliminar grupo ${row.original.name}`} variant="ghost" hitSize={32} iconSize={16} onClick={() => handleDelete(row.original)}>
                        <Trash2 size={16} />
                    </IconButton>
                </div>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <TailChase size="40" speed="1.75" color="var(--semantic-text-primary)" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center py-12">
                <div className="flex items-center gap-3 bg-text-secondary border border-text-secondary text-text-inverse rounded-lg px-6 py-4 max-w-md">
                    <span className="text-h1"><CloudAlert /></span>
                    <div>
                        <p className="font-heading">Error al cargar Grupos</p>
                        <p className="text-small">{error.message}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-h2 text-text-primary font-heading">Grupos</h2>
                <Button className="flex gap-2" onClick={openCreate} variant="soft">
                    <Plus size={18} />
                    Registrar Grupo
                </Button>
            </div>

            <DataTable data={groups} columns={columns} onRowDoubleClick={openView} />

            <Modal
                isOpen={modalOpen}
                onClose={() => !saving && setModalOpen(false)}
                title={modalMode === "view" ? "Visualizar grupo" : modalMode === "edit" ? "Editar grupo" : "Crear grupo"}
                variant="solid"
                footer={modalMode === "view"
                    ? <Button variant="secondary" onClick={() => setModalOpen(false)}>Cerrar</Button>
                    : <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
                    </>
                }
            >
                <Input
                    label="Nombre del grupo"
                    name="name"
                    value={form.name}
                    onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                    required
                    autoFocus
                    disabled={modalMode === "view"}
                />
                <Input
                    label="Descripción"
                    name="description"
                    value={form.description}
                    onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                    optional
                    disabled={modalMode === "view"}
                />
                {modalMode === "view" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input label="Estado" value={editingGroup?.is_active ? "Activo" : "Inactivo"} disabled />
                        <Input label="Permisos asignados" value={String(editingGroup?.permission_count ?? 0)} disabled />
                    </div>
                )}
            </Modal>
        </div>
    );
}
