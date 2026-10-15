# Matriz de trazabilidad y pruebas — SAGI

Objetivo: asignar y ejecutar pruebas **sin abrir la app ni clonar el repo**. Cada fila enlaza requisito → ruta frontend → endpoint → permiso → caso de prueba.

- Rutas frontend: `frontend/src/app/router.jsx`. Endpoints: `docs/endpoints.md`. Permisos: `docs/roles-permisos.md`.
- Usuarios de prueba: ver `docs/instalacion-local.md §3.5` (seeds demo `demo.aprendiz01@sena.edu.co`…) o el superusuario de `createsuperuser`.
- `.env` nunca se publica; en las pruebas solo se nombran **variables**, jamás valores.

## Leyenda de IDs

`CP-<MOD>-<NNN>`: caso de prueba. `MOD`: `AUTH` (auth/sesión/MFA), `USR`, `CON` (consumibles), `DEV` (devolutivos), `CAT` (marcas/categorías/inventarios/cotizaciones), `PRE` (préstamos), `RET` (devoluciones), `TAR`, `ROL` (roles/permisos/elevaciones), `AUD`, `DASH` (panel/soporte), `SYS` (salud/seguridad/media).

## Matriz (extracto asignable por módulo)

| ID | Módulo / requisito | Ruta frontend | Endpoint | Permiso | Tipo | Resultado esperado |
|----|--------------------|---------------|----------|---------|------|--------------------|
| CP-AUTH-001 | Login válido | `/iniciar-sesion` | `POST /api/users/login/` | público | funcional | JWT + usuario + permisos; entra a `/` |
| CP-AUTH-002 | Login inválido / bloqueado | `/iniciar-sesion` | `POST /api/users/login/` | público | negativo | 401, mensaje, sin sesión |
| CP-AUTH-003 | MFA enroll→confirm→verify→disable | perfil / `/iniciar-sesion` | `POST /api/users/me/mfa/enroll|confirm|verify|disable|` + `GET …/status/` | token MFA / sesión | TOTP aceptado (`window=1`); recovery codes 10 un solo uso |
| CP-AUTH-004 | Cambio obligatorio primer login | `/` (modal) | `POST /api/users/me/change-password/first-login/` | sesión + `must_change_password` | flujo | Bloquea (`NotBlockedByPasswordChange`) hasta cambiar |
| CP-AUTH-005 | Forgot→reset | `/forgot-password`, `/reset-password` | `POST /api/users/forgot-password|reset-password/` | público | flujo | Correo/consola; token 15 min; clave nueva válida |
| CP-AUTH-006 | Consentimiento Ley 1581 | modal aviso | `GET/PUT /api/users/me/consent/`, `/aviso-privacidad` | sesión | funcional | Sin consentir limita; `/media` exige sesión |
| CP-USR-001 | Listar / ver usuario | `/usuarios`, `/usuarios/visualizar/:id` | `GET /api/users/`, `GET /api/users/<pk>/` | `view_user` | funcional/permisos | 200 con permiso; 403 sin él |
| CP-USR-002 | Crear usuario | `/usuarios/crear` | `POST /api/users/` | `create_user` | funcional | 201; credenciales por correo/consola |
| CP-USR-003 | Editar / desactivar | `/usuarios/editar/:id` | `PUT/PATCH/DELETE /api/users/<pk>/` | `edit_user` / `delete_user` (destroy superusuario) | funcional | Soft-delete; desaparece del listado |
| CP-USR-004 | Papelera + restaurar + reenviar | (listado) | `GET /api/users/trash/`, `POST …/restore/`, `POST …/resend-credentials/` | `view_user` / `edit_user` | flujo | Restaura y reenvía |
| CP-CON-001 | CRUD consumible | `/consumibles…` | `/api/products/consumables/` | `view/create/edit_consumable` | funcional | CRUD + fotos/ficha; export `export_consumable_materials` |
| CP-DEV-001 | CRUD devolutivo + fichas (1–3) | `/devolutivos…` | `/api/products/returnables/`, `DELETE …/technical-sheets/<pk>/` | `view/create/edit_returnable` | funcional | OneToOne a consumible; `sena_plate/serial` únicos |
| CP-CAT-001 | Marcas/categorías/inventarios | `/configuracion`, `/inventarios`, `/marcas→/configuracion` | `/api/products/brands|categories|inventories/` | `view/create/edit_*` (+ `delete_inventory/delete_category` solo superusuario) | funcional/negativo | ADMIN crea; `DELETE` como ADMIN no-superusuario → 403 |
| CP-CAT-002 | Cotizaciones PDF | `/cotizaciones` | `/api/products/quotations/` | `view/create/edit/delete_quotation` | funcional | Sube/lista/borra PDF (`material` nullable) |
| CP-PRE-001 | Crear borrador (flujo vigente) | `/prestamos/crear` | `POST /api/loans/draft/` | `create_loan` | flujo | `LoanDraft` TTL 24 h + correos con token firma (4 h) |
| CP-PRE-002 | Firmar borrador OTP doble | `/prestamos/firmar`, `/prestamos/firmar-externo` (sin sesión) | `POST …/draft/sign/request-otp/`, `POST …/draft/sign/`, `GET …/draft/<batch>/status/` | token firma | flujo | OTP 10 min/5 intentos; ambas firmas → `Loans` committed |
| CP-PRE-003 | Ver lote / batches | `/prestamos/lote/:batchId` | `GET /api/loans/<id>/`, `GET /api/loans/batches/` | `view_loan` | funcional | Agrupado por `batch_id`; estados Pendiente/Activo/… |
| CP-PRE-004 | Firma legada existente | `/prestamos/firmar` | `POST /api/loans/sign/request-otp|sign/` | token firma | regresión | Solo si aplica; no usar para casos nuevos |
| CP-RET-001 | Devolver lote | `/prestamos/lote/:batchId/devolver` | `POST /api/returns/` | `view_loan` **+** `create_return` | flujo | `Bueno/Mantenimiento/Baja` → Disponible/Mantenimiento/Baja; cierra Finalizado/Incompleto |
| CP-RET-002 | Bloqueo en Pendiente | misma | `POST /api/returns/` | idem | negativo | 400 si préstamo `Pendiente` |
| CP-TAR-001 | Definiciones | `/tareas` | `/api/tasks/definitions/` | `view/create/edit/delete_task` | funcional | CRUD plantilla |
| CP-TAR-002 | Asignar a usuario/grupo + evidencia | `/tareas` | `/api/tasks/assignments/`, `POST …/<id>/evidence/` | `view/create/edit/delete_task_assignment` (lo propio `IsAuthenticated`) | flujo | Estados (5); propio pasa a `En revisión`; email asignada/enviada/actualizada |
| CP-ROL-001 | Grupos y permisos directos | `/configuracion` (Roles y permisos) | `/api/permissions/groups|permissions/`, `/api/permissions/users/<id>/permissions|groups/` | `view_user`/`edit_user` | funcional | Directo > grupo; `scope` SELF/ALL; `my_permission_codes/` refleja |
| CP-ROL-002 | Elevación N1/N2/N3 | `/configuracion` (elevaciones) | `/api/permissions/roles/requests/` | según nivel | flujo | BORRADOR→PENDIENTE→…→ACTIVA; aprobador estrictamente superior; hash anti A→A+ |
| CP-ROL-003 | Campana por permiso | panel | — (`view_loan_notifications` vs `view_task_notifications`) | notificación | funcional | Préstamos XOR tareas; superusuario ambas |
| CP-AUD-001 | Bitácora solo Primigenio | `/auditoria` | `GET /api/audit/?module&action&actor&date_from&date_to&search` | `is_primary_admin` | permisos | No-primigenio → 403 en API y pantalla |
| CP-DASH-001 | Panel y soporte | `/` | `GET /api/dashboard/summary/`, `GET/PUT /api/support/email/` | filtrado por permisos / superusuario PUT | funcional | Contadores según permiso; email soporte actualizable |
| CP-SYS-001 | Salud / media / docs | — | `GET /healthz/`, `GET /media/<path>`, `GET /docs/`, `GET /admin/` | healthz/docs públicos; media con sesión | seguridad | `/media` sin JWT → 401/403; con JWT → 200 |

## Cómo asignar (ejemplo)

- Tester A (auth/usuarios): CP-AUTH-001…006, CP-USR-001…004.
- Tester B (inventario): CP-CON-001, CP-DEV-001, CP-CAT-001/002.
- Tester C (préstamos/devoluciones): CP-PRE-001…004, CP-RET-001/002.
- Tester D (tareas/roles/auditoría): CP-TAR-001/002, CP-ROL-001…003, CP-AUD-001, CP-DASH-001, CP-SYS-001.

Cada caso se ejecuta con 3 usuarios (con permiso / sin permiso / sin sesión) y se registra: pasos, datos de entrada (IDs/`batch_id`, correos demo), respuesta API (código + cuerpoLane), captura solo con datos demo.
