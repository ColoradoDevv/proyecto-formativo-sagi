// frontend/src/features/access/components/AccessSidebar.jsx

import { useState, useEffect } from "react";
import { Users, User } from "lucide-react";
import { EditCard, Select, Button } from "@/shared";
import AccessContextCard from "./AccessContextCard";
import { getGroups } from "../services/groupService";
import { getGroupPermissions } from "../services/permissionService";
import { getUsers, getUserPermissions } from "../services/userPermissionService";

export default function AccessSidebar({
  selectedGroup,
  setSelectedGroup,
  selectedUser,
  setSelectedUser,
  groupPermissions,
  setGroupPermissions,
  isEditing = false,
  refreshKey = 0,
}) {
  // Modo de asignación: por grupo o por usuario individual.
  const [mode, setMode] = useState("group");

  // Estado de los grupos
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    getGroups().then(setGroups).catch(console.error);
  }, [refreshKey]);

  // Estado de los usuarios
  const [users, setUsers] = useState([]);
  useEffect(() => {
    getUsers().then(setUsers).catch(console.error);
  }, []);

  const groupOptions = groups.filter((group) => group.is_active).map((group) => ({
    id: String(group.id),
    label: group.name,
  }));

  const userOptions = users.map((user) => ({
    id: String(user.id),
    label: `${user.first_name} ${user.last_name}`,
  }));

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSelectedGroup("");
    setSelectedUser("");
    setGroupPermissions([]);
  }

  async function handleGroupChange(e) {
    const groupId = e.target.value;

    setSelectedGroup(groupId);
    setSelectedUser("");

    if (!groupId) {
      setGroupPermissions([]);
      return;
    }

    const permissions = await getGroupPermissions(groupId);
    setGroupPermissions(permissions);
  }

  async function handleUserChange(e) {
    const userId = e.target.value;

    setSelectedUser(userId);
    setSelectedGroup("");

    if (!userId) {
      setGroupPermissions([]);
      return;
    }

    const permissions = await getUserPermissions(userId);
    setGroupPermissions(permissions);
  }

  // Etiqueta del destino seleccionado para la tarjeta de contexto.
  const selectedLabel =
    mode === "group"
      ? groupOptions.find((option) => option.id === selectedGroup)?.label
      : userOptions.find((option) => option.id === selectedUser)?.label;

  return (
    <aside className="w-full lg:w-75 lg:shrink-0 flex flex-col gap-4">
      <EditCard title="Seleccionar destino" cols={1}>
        {/* Toggle de modo con botones de shared */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === "group" ? "primary" : "secondary"}
            size="md"
            icon={Users}
            onClick={() => switchMode("group")}
            disabled={isEditing}
          >
            Grupo
          </Button>
          <Button
            variant={mode === "user" ? "primary" : "secondary"}
            size="md"
            icon={User}
            onClick={() => switchMode("user")}
            disabled={isEditing}
          >
            Usuario
          </Button>
        </div>

        {mode === "group" ? (
          <Select
            label="Grupo de usuarios"
            name="groupId"
            value={selectedGroup}
            onChange={handleGroupChange}
            options={groupOptions}
            disabled={isEditing}
          />
        ) : (
          <Select
            label="Usuario individual"
            name="userId"
            value={selectedUser}
            onChange={handleUserChange}
            options={userOptions}
            disabled={isEditing}
          />
        )}
        {isEditing && (
          <p className="text-small text-text-muted mt-1">
            Guarde o cancele los cambios para cambiar de destino.
          </p>
        )}
      </EditCard>

      {selectedLabel && (
        <AccessContextCard
          mode={mode}
          label={selectedLabel}
          activeCount={groupPermissions.length}
        />
      )}
    </aside>
  );
}
