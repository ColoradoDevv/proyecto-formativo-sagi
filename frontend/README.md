# Frontend — SAGI (`frontend/`)

React 19 + Vite 7 + Tailwind 4 + React Router 7 (`package.json`, `vite.config.js`). Alias `@ → ./src`. Sin `.env`: el proxy Vite reenvía `/api` y `/media` a `http://127.0.0.1:8000`.

## Dependencias (`package.json`)

`react@^19.2`, `react-dom`, `react-router-dom@^7.13`, `vite@^7.3`, `@vitejs/plugin-react@^5.1`, `tailwindcss@^4.2` + `@tailwindcss/vite`, `@tanstack/react-table@^8.21`, `jspdf` + `jspdf-autotable`, `xlsx`, `sweetalert2`, `@headlessui/react`, `lucide-react`, `ldrs`, `clsx`. Dev: `eslint@^9`, `eslint-plugin-react-hooks|refresh`, `globals`, `@types/react|dom`.

`vite.config.js`: `manualChunks` (`vendor`, `reports`), `chunkSizeWarningLimit 600`, lazy por módulo (antes un único JS de 1.7 MB).

## Estructura (`src/`)

```
src/
├── app/App.jsx, app/router.jsx, app/NotFoundPage.jsx
├── features/
│   ├── auth/                 # login, forgot/reset, aviso-privacidad, ProtectedRoute, RequirePerms, RequirePrimaryAdmin, modales sesión/MFA/consentimiento, authService, mfaService
│   ├── dashboard/            # / (panel: accesos rápidos, actividad, notificaciones)
│   ├── users/                # /usuarios (listar/crear/visualizar/editar, perfil) + services/hooks/schemas
│   ├── consumable-material/  # /consumibles CRUD
│   ├── returnable-material/  # /devolutivos CRUD + fichas
│   ├── loans/                # /prestamos CRUD + crear draft + firmar (interna/externa) + lote/:batchId + devolver + loanService/returnService/selectServices/hooks
│   ├── quotations/           # /cotizaciones (biblioteca PDF)
│   ├── tasks/                # /tareas (definiciones, asignaciones, evidencias)
│   ├── inventories/          # /inventarios (catálogo nombres)
│   ├── categories/           # catálogo (vía /configuracion)
│   ├── trademarks/           # marcas (vía /configuracion; /marcas redirige)
│   ├── access/               # roles/permisos (AccessPage + permissionService/groupService/userPermissionService + constants/permissionModules.js + scopes.js)
│   ├── elevations/           # solicitudes de rol N1/N2/N3 (vía /configuracion)
│   └── audit/                # /auditoria (solo Primigenio) + auditService/useAuditLogs
├── shared/
│   ├── services/api.js       # apiFetch Bearer, sessionStorage (sesión/permisos), 401 → sia:session-expired, mediaUrl con ?auth=
│   ├── hooks/usePermissions.js  # MODULE_PERMS (espejo 1:1 del backend) + NOTIFICATION_PERMS + can/canAny/isSuper/isAdmin/isPrimaryAdmin
│   ├── layouts/ (MainLayout, ConfigLayout), components/, contexts/, hooks/, alerts/, reports/*ReportConfig.js, table/*Columns.jsx, utils/
├── styles/, assets/ (images/sena/…), main.jsx, index.css
```

## Rutas (`app/router.jsx`)

- Públicas: `/iniciar-sesion`, `/forgot-password`, `/reset-password`, `/aviso-privacidad`, `/prestamos/firmar-externo` (token+OTP, sin sesión).
- Privadas (`<ProtectedRoute />` + `Suspense` lazy): `/`, `/usuarios…`, `/consumibles…`, `/devolutivos…`, `/prestamos…` (`crear`, `visualizar/:id`, `editar/:id`, `lote/:batchId`, `lote/:batchId/devolver` —esta última exige `view_loan` **+** `create_return`), `/prestamos/firmar` (con sesión), `/cotizaciones`, `/tareas`, `/inventarios`, `/marcas`→`/configuracion`, `/configuracion` (`ConfigLayout`), `/auditoria` (`RequirePrimaryAdmin`), `*` (404 privada). Cada rama CRUD usa `RequirePerms perms={MODULE_PERMS.*}` (ver `docs/roles-permisos.md §5`). Títulos por ruta (WCAG 2.4.2, `SAGI · … — SENA`).

## Sesión y permisos en cliente

`authService.js`: `login/forgot/reset/logout/first-login/consent` + `GET /api/permissions/permissions/my_permission_codes/`; guarda sesión y permisos; `usePermissions` lee `sessionStorage` y re-renderiza por eventos `sia:permissions-updated` / `sia:session-updated`; 401 → limpia y emite `sia:session-expired` (modal global).

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo (`vite`, `http://localhost:5173`; backend primero en `:8000`) |
| `npm run start` | Alias de `dev` |
| `npm run build` | Producción (`vite build`, chunks `vendor`/`reports`) |
| `npm run preview` | Preview del build (`vite preview`) |
| `npm run lint` | Lint (`eslint .`; en PRs: `npx eslint <archivos>`) |

Puerto ocupado: `npm run dev -- --port 5174`.
