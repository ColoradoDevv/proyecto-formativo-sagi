import { Pencil } from "lucide-react";
import { Checkbox, AccordionItem, Button, IconButton } from "@/shared";
import { PERMISSION_MODULES } from "../constants/permissionModules";

// Contador "X/Y" mostrado junto al título de cada módulo.
function ModuleHeader({ title, active, total }) {
  return (
    <span className="flex items-center gap-3 text-medium text-text-primary ">
      <span>{title}</span>
      <span
        className={`text-small font-medium px-2 py-0.5 rounded-2xl ${
          active === 0
            ? "bg-surface-muted text-text-muted"
            : "bg-text-primary text-text-inverse"
        }`}
      >
        {active}/{total}
      </span>
    </span>
  );
}

export default function PermissionModule({
  selectedGroup,
  selectedUser,
  isEditing,
  saving,
  permissionsDraft,
  setPermissionsDraft,
  onEdit,
  onCancel,
  onSave,
}) {
  const target = selectedGroup || selectedUser;

  const hasPermission = (codename) =>
    permissionsDraft.some((permission) => permission.codename === codename);

  const countActive = (permissions) =>
    permissions.filter((permission) => hasPermission(permission.codename)).length;

  // En modo edicion solo se toca el borrador; nada se persiste hasta "Guardar".
  function handlePermissionChange(codename, checked) {
    setPermissionsDraft((prev) =>
      checked
        ? [...prev, { codename }]
        : prev.filter((permission) => permission.codename !== codename)
    );
  }

  if (!target) {
    return (
      <div className="rounded-[var(--radius-2xl)] border border-border bg-surface-hover p-8 text-center text-text-muted animate-fade-in">
        Seleccione un grupo o usuario para ver y editar sus permisos.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de acciones: editar / cancelar / guardar */}
      <div className="flex items-center justify-between gap-3 min-h-[var(--size-control-xl)]">
        <p className="text-medium text-text-secondary">
          {isEditing ? "Editando permisos" : "Permisos asignados"}
        </p>
        {!isEditing ? (
          <IconButton ariaLabel="Editar permisos" onClick={onEdit} variant="primary">
            <Pencil size={20} />
          </IconButton>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" size="md" onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-3 max-h-[75vh] overflow-y-auto pr-2">
        {PERMISSION_MODULES.map((module) => (
          <AccordionItem
            key={module.title}
            title={
              <ModuleHeader
                title={module.title}
                active={countActive(module.permissions)}
                total={module.permissions.length}
              />
            }
            defaultOpen={module.title === "Gestión usuarios"}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-4">
              {module.permissions.map(({ codename, label }) => (
                <Checkbox
                  key={codename}
                  id={codename}
                  name={codename}
                  label={label}
                  checked={hasPermission(codename)}
                  disable={!isEditing}
                  onChange={(e) => handlePermissionChange(codename, e.target.checked)}
                />
              ))}
            </div>
          </AccordionItem>
        ))}
      </div>
    </div>
  );
}
