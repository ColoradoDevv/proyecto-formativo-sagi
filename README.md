<div align="center">

<img src="frontend/src/assets/images/sena/logo-sena-verde-500.png" alt="Logo SENA" width="220" />

# SAGI — Sistema de Gestión de Inventario

**Plataforma institucional para la administración de inventarios, préstamos de materiales, tareas y usuarios.**

![Django](https://img.shields.io/badge/Backend-Django_6-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_19-0B1D26?logo=react)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql&logoColor=white)
![SENA](https://img.shields.io/badge/SENA-Proyecto_formativo-39A900)

</div>

---

## ¿Qué es SAGI?

SAGI es una aplicación web desarrollada como **proyecto formativo del SENA** para digitalizar la gestión de los ambientes de formación: controla qué materiales existen, quién los tiene prestados, en qué estado se devuelven y quién responde por cada movimiento. Todo queda registrado y auditado.

## Características principales

- **Inventario centralizado** — materiales consumibles y devolutivos con marcas, categorías, fotos, fichas técnicas (1–3 por material) y cotizaciones en PDF.
- **Préstamos con firma digital** — flujo vigente `draft` (crear → firmar → commit): borrador TTL 24 h, token firma JWT 4 h, OTP 10 min / 5 intentos, firma interna (con sesión) y externa (sin sesión, `/prestamos/firmar-externo`), lotes por `batch_id`.
- **Devoluciones controladas** — registro de devoluciones, sobrantes y validación del estado (`Bueno/Mantenimiento/Baja` → `Disponible/Mantenimiento/Baja`); bloquea si el préstamo está `Pendiente`.
- **Tareas y evidencias** — definiciones + asignaciones a usuario/grupo (5 estados), evidencias con validación de archivo y correos de asignación/envío/actualización.
- **Roles y permisos granulares** — `HasPermission(codename)` en backend + `RequirePerms/MODULE_PERMS` en frontend; niveles `SADMIN 100 / ADMIN 200 / INST 300 / INV 400`; alcance `SELF/ALL`; solicitudes de elevación `N1/N2/N3`; notificaciones `view_loan_notifications` vs `view_task_notifications`.
- **MFA TOTP** — inscripción/verificación con QR, 10 códigos de recuperación de un solo uso (secretos cifrados Fernet, `MFA_ENCRYPTION_KEY`).
- **Reportes exportables** — listados en PDF (`jsPDF`) y Excel (`xlsx`) por módulo, según permiso `export_*`.
- **Auditoría completa** — bitácora de quién hizo qué, cuándo y desde dónde (12 módulos × 14 acciones); lectura solo `is_primary_admin`.
- **Seguridad** — sesión única por usuario (`jti`), cambio de contraseña obligatorio (`must_change_password`), consentimiento Ley 1581, archivos `/media` solo con sesión, `DJANGO_ENV` fail-closed, rate-limit OTP/firma.

## Módulos

| Módulo | Backend (`backend/modules/`) | Frontend (`frontend/src/features/`) | Descripción |
|--------|------------------------------|--------------------------------------|-------------|
| Usuarios + Auth + MFA | `users/` | `auth/`, `users/` | Login/logout, forgot/reset, OTP cambio de clave, consentimiento, TOTP, CRUD + papelera/restore, tipos de documento |
| Material consumible | `products/` → `consumables` | `consumable-material/` | Ingreso, edición y control de existencias |
| Material devolutivo | `products/` → `returnables` | `returnable-material/` | Placa SENA, serie, fotos, fichas técnicas |
| Marcas · Categorías · Inventarios | `products/` → `brands`, `categories`, `inventories` | `trademarks/`, `categories/`, `inventories/` (+ `/configuracion`, `/marcas`→`/configuracion`) | Catálogos administrables |
| Cotizaciones | `products/` → `quotations` | `quotations/` | Biblioteca de PDF (`material` nullable) |
| Préstamos | `loans/` | `loans/` | Draft + firma OTP + lotes + estados |
| Devoluciones | `returns/` | `loans/` (`lote/:batchId/devolver`) | Retorno y estado del material |
| Tareas | `tasks/` → `definitions`, `assignments` | `tasks/` | Definiciones, asignaciones, evidencias |
| Roles y permisos + elevaciones | `permissions/` | `access/`, `elevations/` (+ `/configuracion`) | Grupos, permisos directos, solicitudes `BORRADOR…ACTIVA` |
| Auditoría | `audit/` | `audit/` (`/auditoria`, solo Primigenio) | Bitácora solo lectura |
| Panel + soporte + salud | `home/` (`/`, `/healthz/`, `/api/dashboard/summary/`, `/api/support/email/`) | `dashboard/` | Accesos rápidos, actividad, notificaciones |

## Roles y control de acceso

| Grupo | Nivel | Alcance |
|-------|-------|---------|
| **SADMIN** | 100, sin techo, `is_system`, **solo-backend** | Acceso total: configuración, roles y permisos |
| **ADMIN** | 200, techo 2600 | Gestión de usuarios, materiales, préstamos, reportes y tareas |
| **INST** | 300, techo 1000 | Gestión de materiales y préstamos; `view_quotation` |
| **INV** | 400, techo 500 | Lectura y lo propio (sus préstamos y tareas; `view_task_notifications`) |

Orden: superusuario > permiso directo > permiso por grupo. Detalle, catálogo de codenames y mapa ruta→permiso en [`docs/roles-permisos.md`](docs/roles-permisos.md).

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Django 6 + DRF (Poetry, `requires-python >=3.12,<3.15`), JWT propio PyJWT, TOTP `pyotp`+`qrcode`, `psycopg2`, `django-filter`, `coreapi` (`SGI API`), `whitenoise`, `gunicorn`, `sentry-sdk` |
| Frontend | React 19 + Vite 7 + Tailwind 4 + TanStack Table 8 + React Router 7 + `jspdf`/`xlsx` + `sweetalert2`/`headlessui`/`lucide` (lazy por módulo) |
| Base de datos | SQLite dev / PostgreSQL Supabase staging+prod (pooler 6543, directa 5432 para `migrate`/`pg_dump`) |
| Correo | Consola en dev; SMTP en staging/prod (firmas, credenciales, tareas) |

## Estructura del repositorio

```
proyecto-formativo-sagi/
├── backend/
│   ├── sia_api/        # settings (DJANGO_ENV fail-closed), urls, media con auth, correo, validación, schema
│   ├── modules/        # users · products · loans · returns · tasks · permissions · audit · home
│   ├── templates/      # correos (firmas, credenciales, tareas)
│   ├── tests/          # (base; ver tests por módulo)
│   ├── seed_document_types.py / seed_categories.py / seed_demo_data.py / seed_demo_loans.py
│   ├── .env.example / .env.staging.example / .env.prod.example  # plantillas (los .env reales nunca se suben)
│   └── pyproject.toml  # Dependencias (Poetry)
├── frontend/
│   └── src/
│       ├── app/        # router.jsx (RequirePerms/RequirePrimaryAdmin, lazy chunks)
│       ├── features/   # access, audit, auth, categories, consumable-material, dashboard, elevations, inventories, loans, quotations, returnable-material, tasks, trademarks, users
│       └── shared/     # components, layouts (Main/Config), hooks (usePermissions/MODULE_PERMS), services/api.js, reports, alerts, utils
├── docs/               # arquitectura, instalacion-local, entornos, backups, endpoints, roles-permisos, matriz-pruebas, capturas/
└── scripts/            # db-backup.ps1 / db-backup.sh
```

## Documentación

- [**Instalación local**](docs/instalacion-local.md) — requisitos, backend, frontend y verificación paso a paso.
- [**Arquitectura**](docs/arquitectura.md) — diagrama del sistema, módulos y flujos de autenticación/firma.
- [**Referencia API**](docs/endpoints.md) — tabla exhaustiva método/ruta/permiso (asignar pruebas sin abrir la app).
- [**Roles y permisos**](docs/roles-permisos.md) — niveles, alcances, catálogo y mapa ruta→permiso.
- [**Matriz de pruebas**](docs/matriz-pruebas.md) — trazabilidad requisito→ruta→endpoint→permiso→caso (CP-XXX).
- [**Entornos**](docs/entornos.md) — `dev/staging/prod`, fail-closed y rotación de secretos (solo nombres de variables, sin valores).
- [**Backups**](docs/backups.md) — `pg_dump/restore`, rutina y fallos.
- [**Cómo contribuir**](CONTRIBUTING.md) — ramas, commits, PRs y reglas del equipo.
- READMEs por capa: [`backend/`](backend/README.md) · [`frontend/`](frontend/README.md).

## Puesta en marcha rápida

```bash
# Backend → http://localhost:8000 (API, /docs/, /admin/, /healthz/)
cd backend && poetry install && cp .env.example .env   # Windows: copy .env.example .env
# rellena SECRET_KEY y MFA_ENCRYPTION_KEY (ver docs/instalacion-local.md), luego:
poetry run python manage.py migrate
poetry run python manage.py runserver

# Frontend → http://localhost:5173
cd frontend && npm install && npm run dev
```

> El detalle completo (variables de entorno **por nombre**, base de datos, seeds y solución de problemas) está en la [**guía de instalación local**](docs/instalacion-local.md). Los `.env` reales nunca se publican.

---

<div align="center">

**Proyecto formativo — SENA** · Desarrollado por [ColoradoDevv](https://github.com/ColoradoDevv)

</div>
