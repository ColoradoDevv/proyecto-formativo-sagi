# Referencia API — SAGI

Fuente de verdad del contrato REST. Generada desde `backend/sia_api/urls.py` y los `urls.py` de cada módulo. Auth global: `IsAuthenticated + NotBlockedByPasswordChange` (`backend/sia_api/settings.py:202-216`); autenticación `modules.users.authentication.JWTAuthentication` (`Bearer`, sesión única por `jti`, blacklist SHA-256). Docs interactivas en `http://localhost:8000/docs/` (título real `SGI API`, `backend/sia_api/urls.py:26`).

Convenciones: `OTP` = 6 dígitos, hash SHA-256, TTL 10 min, 5 intentos (`modules/users/models.py`, `modules/loans/models.py`). `Sign token` = JWT `scope=loan_sign`, TTL 4 h (`modules/loans/views.py`). `MFA token` = JWT `scope=mfa`, TTL 5 min (`modules/users/mfa.py`).

## Base / sistema (`modules/home/urls.py`)

| Método | Ruta | Auth | Permiso | Descripción |
|--------|------|------|---------|-------------|
| GET | `/` | No | — | Índice API |
| GET | `/healthz/` | No (`AllowAny`) | — | Healthcheck 200/503 (usado en smoke y `docs/entornos.md`) |
| GET | `/api/dashboard/summary/` | Sí | Filtrado por permisos del usuario | Contadores para el panel |
| GET | `/api/support/email/` | No | — | Leer email de soporte |
| PUT | `/api/support/email/` | Sí | Superusuario | Actualizar email de soporte |
| GET | `/admin/` | Sesión Django | Staff | Admin Django |
| GET | `/docs/` | — | — | Documentación auto (coreapi) |
| GET | `/media/<path>` | Sí (`AuthenticatedMediaView`) | Sesión válida | Archivos privados (Ley 1581). En prod el servidor web debe redirigir `/media/*` a Django |

## Usuarios (`api/users/`, `backend/modules/users/urls.py`)

| Método | Ruta | Auth | Permiso | Descripción |
|--------|------|------|---------|-------------|
| POST | `/api/users/login/` | No | — | Login email+password. Responde JWT (8 h) o `mfa_required` + token MFA (5 min) |
| POST | `/api/users/logout/` | Sí | — | Revoca JWT (blacklist SHA-256) |
| POST | `/api/users/forgot-password/` | No | — | Envía correo reset (o consola en dev) |
| POST | `/api/users/reset-password/` | No | — | Restablece con token (15 min) |
| GET/PUT | `/api/users/me/` | Sí | Propio | Ver/editar perfil |
| POST | `/api/users/me/change-password/request/` | Sí | — | OTP para cambio de clave |
| POST | `/api/users/me/change-password/confirm/` | Sí | — | Confirma OTP + nueva clave |
| POST | `/api/users/me/change-password/first-login/` | Sí | — | Cambio obligatorio (`must_change_password`) |
| GET/PUT | `/api/users/me/consent/` | Sí | — | Consentimiento datos Ley 1581 |
| POST | `/api/users/me/mfa/enroll/` | Token MFA | — | Inicia inscripción TOTP (devuelve QR/`otpauth://`) |
| POST | `/api/users/me/mfa/confirm/` | Token MFA | — | Confirma TOTP y activa MFA |
| POST | `/api/users/me/mfa/verify/` | Token MFA | — | Verifica TOTP o código de recuperación (10 códigos) |
| POST | `/api/users/me/mfa/disable/` | Sí | — | Desactiva MFA |
| GET | `/api/users/me/mfa/status/` | Sí | — | Estado MFA del usuario |
| GET/POST | `/api/users/` | Sí | `view_user` (listar) / `create_user` (crear) | CRUD usuarios |
| GET | `/api/users/trash/` | Sí | `view_user` | Papelera (soft-delete) |
| GET/PUT/PATCH/DELETE | `/api/users/<pk>/` | Sí | `view_user` / `edit_user` / `delete_user` (solo superusuario en destroy) | Detalle / editar / soft-delete |
| POST | `/api/users/<pk>/restore/` | Sí | `edit_user` | Restaurar de papelera |
| POST | `/api/users/<pk>/resend-credentials/` | Sí | `edit_user` | Reenviar credenciales |
| GET | `/api/users/document-types/` | Sí | — | Tipos de documento |
| — | `/api/users/roles/` | — | — | **Eliminada** (campo `role` removido, migración `0003`; `Role` solo histórico) |

Notas: `User.USERNAME_FIELD = email` (`modules/users/models.py`); `is_primary_admin` irreversible por API; `is_deleted/deleted_at` + managers `objects/all_objects`; `PasswordChangeOTP` y `SignOTP` con TTL 10 min / 5 intentos; comando `cleanup_blacklisted_tokens.py`, `mfa_reset.py`, `migrate_roles_to_groups.py`.

## Permisos y roles (`api/permissions/`, `backend/modules/permissions/urls.py`)

| Método | Ruta | Auth | Permiso | Descripción |
|--------|------|------|---------|-------------|
| GET/POST | `/api/permissions/permissions/` | Sí | `view_user` (listar) / `edit_user` (gestionar) | Catálogo de permisos |
| GET/POST | `/api/permissions/groups/` | Sí | idem | Grupos/roles (SADMIN solo backend) |
| GET/POST | `/api/permissions/roles/requests/` | Sí | Flujo elevación | Solicitudes `BORRADOR→PENDIENTE→APROBADA/RECHAZADA/EXPIRADA/CANCELADA→ACTIVA` (máx 5 pendientes, 7 días) |
| GET/PUT | `/api/permissions/users/<user_id>/permissions/` | Sí | — | Permisos directos (+ `scope` SELF/ALL) |
| GET/PUT | `/api/permissions/users/<user_id>/groups/` | Sí | — | Membresías |
| GET | `/api/permissions/permissions/my_permission_codes/` | Sí | — | Codenames efectivos (los guarda el frontend en sesión) |

Ver catálogo y niveles en `docs/roles-permisos.md`.

## Productos / catálogos (`api/products/`, `backend/modules/products/urls.py`)

Router DRF (`brands`, `inventories`, `categories`, `consumables`, `returnables`, `quotations`) + `DELETE /api/products/technical-sheets/<pk>/`.

| Recurso | Endpoints | Permisos exigidos (`modules/products/views.py`) |
|---------|-----------|--------------------------------------------------|
| Marcas | `GET/POST /brands/`, `GET/PUT/PATCH/DELETE /brands/<id>/` | `view_brand`, `create_brand`, `edit_brand` |
| Inventarios | `GET/POST /inventories/`, `.../<id>/` (DELETE solo superusuario) | `view_inventory`, `create_inventory`, `edit_inventory`, `delete_inventory` |
| Categorías | `GET/POST /categories/`, `.../<id>/` (DELETE solo superusuario) | `view_category`, `create_category`, `edit_category`, `delete_category` |
| Consumibles | `GET/POST /consumables/`, `.../<id>/` | `view_consumable`, `create_consumable`, `edit_consumable` |
| Devolutivos | `GET/POST /returnables/`, `.../<id>/`, `DELETE /technical-sheets/<pk>/` (`edit_returnable`) | `view_returnable`, `create_returnable`, `edit_returnable` |
| Cotizaciones | `GET/POST /quotations/`, `.../<id>/` | `view_quotation`, `create_quotation`, `edit_quotation`, `delete_quotation` |

Modelos: `Brand`, `Inventory`, `Category`, `ConsumableMaterial` (M2M `cuentadantes`, `sena_plate/serial` únicos opcionales), `ReturnableMaterial` (OneToOne PK a consumible + `Category` RESTRICT), `TechnicalSheet` (1–3 por material), `Quotation` (`material` nullable). Filtros globales `DjangoFilterBackend + SearchFilter + OrderingFilter`.

## Préstamos (`api/loans/`, `backend/modules/loans/urls.py`)

| Método | Ruta | Auth | Permiso | Descripción |
|--------|------|------|---------|-------------|
| GET/POST | `/api/loans/` | Sí | `view_loan` / `create_loan` | Listar / crear (legado; el flujo vigente es `draft/`) |
| GET/PATCH/DELETE | `/api/loans/<id>/` | Sí | `view_loan` / `edit_loan` / destroy solo superusuario | Detalle / editar / eliminar |
| POST | `/api/loans/sign/request-otp/` | Token firma | — | OTP firma sobre préstamo existente (legado) |
| POST | `/api/loans/sign/` | Token firma | — | Firma préstamo existente |
| POST | `/api/loans/draft/` | Sí | `create_loan` | **Flujo vigente**: crea `LoanDraft` (TTL 24 h) y envía 1 correo por rol con JWT firma |
| POST | `/api/loans/draft/sign/request-otp/` | Token firma | — | OTP firma de borrador |
| POST | `/api/loans/draft/sign/` | Token firma | — | Firma borrador; al completar ambas firmas crea los `Loans` (`committed`) |
| GET | `/api/loans/draft/<batch_id>/status/` | Sí/Token | — | Polling de estado del lote |
| GET | `/api/loans/batches/` | Sí | `view_loan` | Listado agrupado por `batch_id` |

Estados `Pendiente|Activo|Finalizado|Incompleto`, tipos `Interno|Externo` (receptor externo `receptor_name/email`, firma sin sesión en `/prestamos/firmar-externo`). Firmas guardan `signed_by/at/ip/ua`. Rate-limit firmas: OTP 5/15 min, firma 10/15 min.

## Devoluciones (`api/returns/`)

`POST /api/returns/` (crear, `create_return`; resto de acciones solo superusuario — `modules/returns/views.py:16-105`). Bloquea si el préstamo está `Pendiente`. `material_condition: Bueno|Mantenimiento|Baja` → estado material `Disponible|Mantenimiento|Baja`. Consumibles: `quantity - amount_lent + leftover` si `Bueno`. Cierra el préstamo como `Finalizado`/`Incompleto`.

## Tareas (`api/tasks/`)

| Recurso | Endpoints | Permisos (`modules/tasks/views.py`) |
|---------|-----------|--------------------------------------|
| Definiciones | `GET/POST /definitions/`, `.../<id>/` | `view_task`, `create_task`, `edit_task`, `delete_task` |
| Asignaciones | `GET/POST /assignments/`, `.../<id>/`, `POST /assignments/<id>/evidence/` | `view_task_assignment` (listar; lo propio con `IsAuthenticated`), `create_task_assignment`, `edit_task_assignment` (finalizar lo propio), `delete_task_assignment` |

`TaskAssignment scope user|group`, 5 estados, `requires_evidence`, unicidad parcial tarea+usuario/grupo. Correos `task_assigned/submitted/updated.html`. Evidencias validadas por `sia_api/file_validation.py`.

## Auditoría (`api/audit/`)

`GET /api/audit/?module&action&actor&date_from&date_to&search` — solo `is_primary_admin` (`modules/audit/views.py:16-26`). `AuditLog`: actor snapshot, `module` (12: users/consumables/returnables/brands/loans/returns/tasks/auth/permissions/categories/inventories/quotations), `action` (14: CREATE…SIGN_LOAN), `target_id/repr`, `detail`, `ip`, `timestamp`. Escritura vía `AuditMixin` + login/logout/firmas.

## Códigos de error comunes

| Código | Cuándo |
|--------|--------|
| 401 | Sin JWT, JWT expirado/revocado, `jti` distinto (sesión única), OTP/token firma inválido |
| 403 `Permiso requerido: <codename>` | Falta permiso directo o por grupo (`HasPermission`) |
| 403 cambio de clave | `must_change_password=true` y la ruta no permite `allow_during_password_change` |
| 404 | Recurso inexistente o soft-deleted (usa `trash/` + `restore/`) |
| 429 | Rate-limit OTP/firma |
