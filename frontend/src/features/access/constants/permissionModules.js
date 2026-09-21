// Catálogo de módulos y permisos del sistema.
// Los codenames deben coincidir con la migración del backend
// 0002_load_initial_permissions. Fuente única de verdad para la UI de access.

export const PERMISSION_MODULES = [
  {
    title: "Gestión usuarios",
    permissions: [
      { codename: "create_user", label: "Crear usuarios" },
      { codename: "list_users", label: "Listar usuarios" },
      { codename: "update_user", label: "Actualizar usuarios" },
      { codename: "disable_user", label: "Deshabilitar usuarios" },
      { codename: "view_user", label: "Ver usuarios" },
      { codename: "export_users", label: "Generar reporte de usuarios" },
      { codename: "edit_user", label: "Editar usuarios" },
      { codename: "delete_user", label: "Eliminar usuarios" },
    ],
  },
  {
    title: "Materiales devolutivos",
    permissions: [
      { codename: "create_returnable_material", label: "Crear material devolutivo" },
      { codename: "list_returnable_materials", label: "Listar materiales devolutivos" },
      { codename: "view_returnable_material", label: "Ver material devolutivo" },
      { codename: "update_returnable_material", label: "Actualizar material devolutivo" },
      { codename: "disable_returnable_material", label: "Deshabilitar material devolutivo" },
      { codename: "export_returnable_materials", label: "Generar reporte de materiales devolutivos" },
      { codename: "create_returnable", label: "Crear material devolutivo (API)" },
      { codename: "view_returnable", label: "Ver material devolutivo (API)" },
      { codename: "edit_returnable", label: "Editar material devolutivo (API)" },
    ],
  },
  {
    title: "Materiales de consumo",
    permissions: [
      { codename: "create_consumable_material", label: "Crear material de consumo" },
      { codename: "list_consumable_materials", label: "Listar materiales de consumo" },
      { codename: "view_consumable_material", label: "Ver material de consumo" },
      { codename: "update_consumable_material", label: "Actualizar material de consumo" },
      { codename: "disable_consumable_material", label: "Deshabilitar material de consumo" },
      { codename: "export_consumable_materials", label: "Generar reporte de materiales de consumo" },
      { codename: "create_consumable", label: "Crear material de consumo (API)" },
      { codename: "view_consumable", label: "Ver material de consumo (API)" },
      { codename: "edit_consumable", label: "Editar material de consumo (API)" },
    ],
  },
  {
    title: "Préstamos",
    permissions: [
      { codename: "create_loan", label: "Crear préstamo" },
      { codename: "list_loans", label: "Listar préstamos" },
      { codename: "view_loan", label: "Ver préstamo" },
      { codename: "update_loan", label: "Actualizar préstamo" },
      { codename: "export_loans", label: "Generar reporte de préstamos" },
      { codename: "return_material", label: "Devolver material devolutivo" },
      { codename: "register_surplus", label: "Registrar sobrante" },
      { codename: "validate_loan_return", label: "Validar devolución" },
      { codename: "create_return", label: "Registrar devolución de préstamo (API)" },
    ],
  },
  {
    title: "Marcas",
    permissions: [
      { codename: "create_brand", label: "Crear marca" },
      { codename: "list_brands", label: "Listar marcas" },
      { codename: "update_brand", label: "Actualizar marca" },
      { codename: "disable_brand", label: "Deshabilitar marca" },
    ],
  },
  {
    title: "Nombres de inventario",
    permissions: [
      { codename: "create_inventory", label: "Crear nombre de inventario" },
      { codename: "view_inventory", label: "Ver nombres de inventario" },
      { codename: "edit_inventory", label: "Editar nombre de inventario" },
      { codename: "delete_inventory", label: "Eliminar nombre de inventario" },
    ],
  },
  {
    title: "Categorias",
    permissions: [
      { codename: "create_category", label: "Crear categoria" },
      { codename: "view_category", label: "Ver categorias" },
      { codename: "edit_category", label: "Editar categoria" },
      { codename: "delete_category", label: "Eliminar categoria" },
    ],
  },
  {
    title: "Roles y permisos",
    permissions: [
      { codename: "create_role", label: "Crear rol" },
      { codename: "list_roles", label: "Listar roles" },
      { codename: "update_role", label: "Actualizar rol" },
      { codename: "disable_role", label: "Deshabilitar rol" },
      { codename: "manage_role_permissions", label: "Gestionar permisos de rol" },
    ],
  },
  {
    title: "Tareas",
    permissions: [
      { codename: "create_task", label: "Crear tarea" },
      { codename: "list_tasks", label: "Listar tareas" },
      { codename: "view_task", label: "Ver tarea" },
      { codename: "update_task", label: "Actualizar tarea" },
    ],
  },
  {
    title: "Autenticación y sesión",
    permissions: [
      { codename: "view_own_profile", label: "Ver perfil propio" },
      { codename: "change_password", label: "Cambiar contraseña" },
    ],
  },
];

// Total de permisos del catálogo (para mostrar "X de N" sin recalcular en la UI).
export const TOTAL_PERMISSIONS = PERMISSION_MODULES.reduce(
  (sum, module) => sum + module.permissions.length,
  0
);
