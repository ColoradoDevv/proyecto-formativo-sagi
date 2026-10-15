# Roles y permisos — SAGI

Modelo real verificado en `backend/modules/permissions/` (modelos, `services.py`, `ranking.py`, `permissions_drf.py`, migraciones) y su espejo frontend `frontend/src/shared/hooks/usePermissions.js` + `frontend/src/features/access/constants/permissionModules.js`.

## 1. Principios

1. **Superusuario (`is_superuser`) > permiso directo (`UserPermission`) > permiso por grupo (`GroupPermission`)** (`PermissionService.has_permission`, `modules/permissions/services.py` + caché 300 s).
2. El backend exige **un codename por acción** con `HasPermission("<codename>")` (`modules/permissions/permissions_drf.py`; también `HasAnyPermission/HasAllPermissions/IsSuperUser`, decoradores `require_permission/*`).
3. El frontend **nunca hardcodea nombres de grupo**: protege rutas con `RequirePerms perms={MODULE_PERMS.*}` y `RequirePrimaryAdmin` (`frontend/src/app/router.jsx`). `is_superuser` hace bypass en `can/canAny`.
4. **Alcance (`scope`)**: `SELF` (lo propio) o `ALL` (todo), default seguro `SELF`. Solo aplica a permisos con objeto (`ranking.py:20-31`: `view_loan/list_loans/edit_loan/delete_loan/return_material/register_surplus/validate_loan_return/view|edit|delete_task_assignment`); en el resto se ignora. `effective_scope()` = `ALL` si alguna vía lo otorga.
5. **Jerarquía por nivel, no por suma de pesos**: `Group.level` menor = más poder. Niveles sistema (migración `0019`): `SADMIN 100 (sin techo)`, `ADMIN 200 (techo 2600)`, `INST 300 (techo 1000)`, `INV 400 (techo 500)`; roles nuevos nacen en `900`. `is_system=true` = inmutable por API. `can_manage_user` (mismo nivel o inferior), `can_manage_group` (estrictamente inferior), `can_grant_permission` (sin auto-amplificación). `weight` (`Permission.weight`, default 10) es solo métrica de análisis; solo la edita el Primigenio.
6. **Notificaciones excluyentes**: `view_loan_notifications` (SADMIN/ADMIN/INST) vs `view_task_notifications` (INV); el superusuario ve ambas (`NOTIFICATION_PERMS`, migraciones `0016`).

## 2. Grupos base (migraciones `0002` + `0019`)

| Grupo | level | Techo | Alcance inicial |
|-------|-------|-------|-----------------|
| SADMIN | 100, `is_system`, sin techo | — | Todos los permisos. **Solo-backend**: no se gestiona desde la UI pública |
| ADMIN | 200, `is_system` | 2600 | Gestión usuarios/materiales/préstamos/tareas/catálogos |
| INST | 300, `is_system` | 1000 | Materiales + préstamos; `view_quotation` (lectura cotizaciones) |
| INV | 400, `is_system` | 500 | Lectura + lo propio (sus préstamos/tareas) |

Detalle histórico: la semilla `0002` usa codenames legacy RFADMIN (`list_users`, `create_returnable_material`, …). El código **vigente** verifica los codenames de la sección 3 (ver comentario en `usePermissions.js:14-21`: los legacy ya no se verifican). Las migraciones `0004–0024` crean/otorgan los codenames vigentes y hacen backfill de `scope` (`level <= 200 → ALL`).

## 3. Catálogo de permisos **exigidos hoy** (backend ↔ frontend)

| Dominio | Codenames exigidos | Frontend (`MODULE_PERMS`) |
|---------|--------------------|---------------------------|
| Usuarios | `view_user`, `create_user`, `edit_user`, `delete_user`, `export_users` (export solo reportes) | `users.{view,create,edit,remove,export}` |
| Consumibles | `view_consumable`, `create_consumable`, `edit_consumable`, `export_consumable_materials` | `consumables.{view,create,edit,export}` |
| Devolutivos | `view_returnable`, `create_returnable`, `edit_returnable`, `export_returnable_materials` | `returnables.{view,create,edit,export}` |
| Préstamos | `view_loan`, `create_loan`, `edit_loan`, `export_loans`, `create_return` | `loans.{view,create,edit,export,createReturn}` |
| Cotizaciones | `view_quotation`, `create_quotation`, `edit_quotation`, `delete_quotation` | `quotations.{view,create,edit,remove}` |
| Tareas | `view_task`, `create_task`, `edit_task`, `delete_task`, `view_task_assignment`, `create_task_assignment`, `edit_task_assignment`, `delete_task_assignment`, `export_tasks`, `export_task_assignments` | `tasks.{view,create,edit,remove,export}` (view/create/edit/remove/export agrupan definition+assignment) |
| Inventarios | `view_inventory`, `create_inventory`, `edit_inventory`, `delete_inventory` (delete solo superusuario) | `inventories.{view,create,edit,remove}` |
| Marcas | `view_brand`, `create_brand`, `edit_brand` | vía Configuración (modales) |
| Categorías | `view_category`, `create_category`, `edit_category`, `delete_category` (delete solo superusuario) | vía Configuración |
| Roles/permisos | gestión vía `view_user`/`edit_user` en UI; críticos ponderados (`authority.py`): `create_role` 150, `update_role`/`disable_role`/`manage_role_permissions` 100, `export_audit` 50, `approve_elevation` 30 | `features/access` (`AccessPage`) |
| Notificaciones | `view_loan_notifications`, `view_task_notifications` | `NOTIFICATION_PERMS.{loans,tasks}` |
| Auditoría | sin codename: **solo `is_primary_admin`** (`modules/audit/views.py`) | `RequirePrimaryAdmin` en `/auditoria` |

Otorgamientos base por grupo (migraciones `0007–0016`, `0020`): consumibles/devolutivos ver→`ADMIN/INST/INV/SADMIN`, crear/editar→`ADMIN/INST/SADMIN`, `create_return`→los 4; inventarios/categorías/cotizaciones→`ADMIN/SADMIN` (+ `view_quotation` a `INST` en `0013`, `view_brand/view_inventory/view_category` a `INST/INV` en `0012`); tareas y `edit_task`→`ADMIN/SADMIN`; exportaciones tareas→`ADMIN/SADMIN`; `view_user` listado→`INST/INV` (`0020`); notificaciones préstamo→`SADMIN/ADMIN/INST`, tareas→`INV`.

## 4. Elevaciones / solicitudes de rol (`SolicitudCambioRol`)

Estados `BORRADOR→PENDIENTE→APROBADA|RECHAZADA|EXPIRADA|CANCELADA→ACTIVA` (`models.py:241-256`), máx 5 pendientes/usuario, vigencia 7 días, hash SHA-256 anti `A→A+` (`elevation.py`). Quien propone no aprueba lo propio; el aprobador debe ser **estrictamente superior**. Clasificación `N1/N2/N3` + pesos críticos (`ranking.py:122-172`, `authority.py`). UI en `features/elevations` + `/configuracion`. Permiso `approve_elevation` (peso 30).

## 5. Mapa ruta frontend → permiso (asignación de pruebas)

| Ruta | Guardia | Permiso |
|------|---------|---------|
| `/usuarios`, `/usuarios/visualizar/:id` | `RequirePerms` | `view_user` |
| `/usuarios/crear` | `RequirePerms` | `create_user` |
| `/usuarios/editar/:id` | `RequirePerms` | `edit_user` |
| `/consumibles`, `…/visualizar/:id` | `RequirePerms` | `view_consumable` |
| `/consumibles/crear` | `RequirePerms` | `create_consumable` |
| `/consumibles/editar/:id` | `RequirePerms` | `edit_consumable` |
| `/devolutivos…` | `RequirePerms` | `view_returnable` / `create_returnable` / `edit_returnable` |
| `/prestamos`, `…/visualizar/:id`, `…/lote/:batchId` | `RequirePerms` | `view_loan` |
| `/prestamos/crear` | `RequirePerms` | `create_loan` |
| `/prestamos/editar/:id` | `RequirePerms` | `edit_loan` |
| `/prestamos/lote/:batchId/devolver` | `RequirePerms requireAll` | `view_loan` **+** `create_return` |
| `/prestamos/firmar` | sesión | token firma + OTP |
| `/prestamos/firmar-externo` | **pública** | token firma + OTP (sin sesión) |
| `/cotizaciones` | `RequirePerms` | `view_quotation` |
| `/tareas` | `RequirePerms` | `view_task` + `view_task_assignment` |
| `/inventarios` | `RequirePerms` | `view_inventory` |
| `/marcas` → `/configuracion` | `ConfigLayout` | `view_brand` (modales) |
| `/configuracion` | `ConfigLayout` | según pestaña (roles/permisos, catálogos, elevaciones) |
| `/auditoria` | `RequirePrimaryAdmin` | `is_primary_admin` (sin codename) |

## 6. Cómo probar permisos (sin entrar a la app)

1. Crear matriz usuario×ruta con un usuario por grupo (SADMIN/ADMIN/INST/INV + personalizado + sin permiso).
2. Para API: llamar cada endpoint de `docs/endpoints.md` con y sin JWT y con JWT de cada grupo; esperar `401` sin sesión y `403 Permiso requerido: <codename>` sin permiso.
3. Para UI: navegar cada ruta de la tabla 5 con cada usuario; esperar render o pantalla `403`/redirección según `RequirePerms`.
4. Casos negativos obligatorios: `INV` creando consumible (`403 create_consumable`), no-primigenio en `GET /api/audit/` (`403`), `DELETE /api/products/inventories/<id>/` como ADMIN no-superusuario (`403`), firma con OTP vencido/reusado (`401/400`).
