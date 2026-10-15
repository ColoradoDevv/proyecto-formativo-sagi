# Arquitectura de SAGI

Visión general del sistema: dos aplicaciones (frontend + API) sobre una sola base de datos por entorno (`docs/entornos.md`).

## Diagrama general

```mermaid
flowchart LR
    U[Usuario] --> F[Frontend\nReact 19 + Vite]
    F -->|/api · JWT| B[Backend\nDjango 6 + DRF]
    F -->|/media · con sesion| B
    B --> DB[(SQLite en dev\nPostgreSQL Supabase en staging/prod)]
    B --> M[Correo SMTP/consola\nfirmas OTP · credenciales · tareas]
    B --> OB[Logs consola\nSentry opcional]
```

- En desarrollo, Vite redirige `/api` y `/media` al backend (`127.0.0.1:8000`); el frontend no necesita `.env` (`frontend/vite.config.js`).
- Los archivos (`/media`: fotos, fichas, cotizaciones, evidencias) solo se sirven con sesión (`AuthenticatedMediaView`, Ley 1581 de 2012). En prod el servidor web debe redirigir `/media/*` a Django.
- Estáticos de prod vía WhiteNoise (`STATIC_ROOT`); `CONN_MAX_AGE=0` con PgBouncer pooler `6543`; directa `5432` para `migrate`/`pg_dump`.

## Módulos

```mermaid
flowchart TB
    subgraph Frontend ["Frontend · src/"]
        R[app/Router\nProtectedRoute + RequirePerms\nRequirePrimaryAdmin · lazy chunks]
        FE[features/\nauth · users · consumable-material\nreturnable-material · loans · quotations\ntasks · inventories · categories\ntrademarks · access · elevations\naudit · dashboard]
        SH[shared/\nlayouts · components · hooks\nusePermissions/MODULE_PERMS\nservices/api.js · reports]
    end
    subgraph Backend ["Backend · modules/"]
        API[sia_api/\nURLs · media con auth · correo\nvalidacion · schema tolerant]
        MU[users\nUser+MFA+OTP+JWT] --- MP[products\nbrands/categories/inventories\nconsumables/returnables/quotations]
        ML[loans\ndraft 24h + sign OTP] --- MR[returns\nBueno/Mantenimiento/Baja]
        MT[tasks\ndefinitions + assignments] --- MPE[permissions\ngroups/levels/scopes\nelevations N1-N3]
        MA[audit\nsolo Primigenio] --- MH[home\nhealthz/dashboard/support]
    end
    FE --> SH
    R --> FE
    FE -->|REST| API
    API --> MU & MP & ML & MR & MT & MPE & MA & MH
```

Detalle de contratos: [`endpoints.md`](endpoints.md) (API), [`roles-permisos.md`](roles-permisos.md) (autorización), [`matriz-pruebas.md`](matriz-pruebas.md) (trazabilidad a pruebas).

## Autenticación y permisos

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Backend
    participant DB as Base de datos
    UI->>API: login (email + contrasena)
    API->>DB: valida usuario + sesion unica (jti)
    alt MFA activo
        API->>UI: mfa_required + token MFA (5 min)
        UI->>API: POST me/mfa/verify (TOTP/recovery)
    end
    API->>UI: JWT (8 h) + codigos de permiso
    UI->>UI: guarda sesion/permisos (usePermissions)
    UI->>API: GET /api/... con JWT
    API->>DB: HasPermission (superusuario > directo > grupo)
    API->>UI: datos o 403 Permiso requerido
```

```mermaid
sequenceDiagram
    participant C as Creador (con create_loan)
    participant API as Backend
    participant R1 as Firmante interno
    participant R2 as Receptor externo
    C->>API: POST /api/loans/draft/ (JWT)
    API->>API: crea LoanDraft TTL 24h + tokens firma 4h
    API->>R1: correo con enlace firmacon token
    API->>R2: correo con enlace /prestamos/firmar-externo
    R1->>API: POST draft/sign/request-otp/ + /sign/ (OTP 10min/5int)
    R2->>API: POST draft/sign/request-otp/ + /sign/ (sin sesion)
    API->>API: ambas firmas -> Loans committed
```

Reglas clave:

- **Superusuario** > **permiso directo** > **permiso por grupo** (`PermissionService`, caché 300 s).
- Niveles `SADMIN 100 / ADMIN 200 / INST 300 / INV 400` (menor = más poder), techos y `is_system`; alcance `SELF/ALL` solo en permisos con objeto.
- Los permisos se administran en la UI (Roles y permisos) y se exigen en el backend con `HasPermission("<codename>")`; el frontend los refleja con `MODULE_PERMS` (nunca nombres de grupo hardcodeados).
- Las migraciones crean los permisos y los grupos base; las `0004–0024` agregan los codenames vigentes y el backfill de alcance.
- Auditoría: escritura por `AuditMixin`/login/logout/firmas; lectura `GET /api/audit/` solo `is_primary_admin`.
- Filtros globales: `DjangoFilterBackend + SearchFilter + OrderingFilter`.

## Capturas de pantalla

Las imágenes de la interfaz viven en [`capturas/`](capturas/) (ver su `README` para la convención de nombres y módulos a cubrir).

---

← [Volver al README](../README.md) · [Instalación local](instalacion-local.md) · [Referencia API](endpoints.md) · [Roles y permisos](roles-permisos.md)
