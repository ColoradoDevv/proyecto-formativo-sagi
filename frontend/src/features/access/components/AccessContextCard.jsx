import { Users, User } from "lucide-react";
import { TOTAL_PERMISSIONS } from "../constants/permissionModules";

// Tarjeta de contexto: muestra a quién se le están editando los permisos
// (grupo o usuario) y cuántos tiene activos sobre el total del catálogo.
// Usa las mismas clases-token (border, surface, success) del resto de cards.
export default function AccessContextCard({ mode, label, activeCount }) {
  const isGroup = mode === "group";
  const Icon = isGroup ? Users : User;
  const subtitle = isGroup ? "Grupo seleccionado" : "Usuario seleccionado";

  return (
    <div className="flex flex-col gap-4 p-4 rounded-[var(--radius-2xl)] border border-border bg-surface-hover animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-full)]  text-text-primary shrink-0">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-medium font-heading text-text-primary truncate">{label}</p>
          <p className="text-small text-text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] bg-text-primary py-2">
          <span className="text-h3 font-heading text-text-inverse leading-none">{activeCount}</span>
          <span className="text-small text-text-inverse">permisos activos</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] bg-surface-muted py-2">
          <span className="text-h3 font-heading text-text-secondary leading-none">{TOTAL_PERMISSIONS}</span>
          <span className="text-small text-text-secondary">totales</span>
        </div>
      </div>
    </div>
  );
}
