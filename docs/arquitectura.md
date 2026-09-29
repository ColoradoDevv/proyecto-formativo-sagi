# Arquitectura de SAGI

Visión general del sistema: dos aplicaciones (frontend + API) sobre una sola base de datos.

## Diagrama general

```mermaid
flowchart LR
    U[Usuario] --> F[Frontend\nReact 19 + Vite]
    F -->|/api · JWT| B[Backend\nDjango 6 + DRF]
    F -->|/media · con sesion| B
    B --> DB[(PostgreSQL en Supabase\nSQLite en desarrollo local)]
    B --> M[Correo SMTP\nfirmas OTP y avisos]
```

- En desarrollo, Vite redirige `/api` y `/media` al backend (`127.0.0.1:8000`); el frontend no necesita `.env`.
- Los archivos (`/media`: fotos, fichas, cotizaciones) solo se sirven con sesión (Ley 1581 de 2012).

## Módulos

```mermaid
flowchart TB
    subgraph Frontend ["Frontend · src/"]
        R[app/Router\nrutas protegidas con RequirePerms]
        FE[features/\nusuarios · materiales · prestamos\ntareas · cotizaciones · auditoria ...]
        SH[shared/\ncomponentes · layouts · hooks · servicios]
    end
    subgraph Backend ["Backend · modules/"]
        API[sia_api/\nURLs · media con auth · correo]
        MU[users] --- MP[products]
        ML[loans] --- MR[returns]
        MT[tasks] --- MPE[permissions]
        MA[audit] --- MH[home]
    end
    FE --> SH
    R --> FE
    FE -->|REST| API
    API --> MU & MP & ML & MR & MT & MPE & MA & MH
```

## Autenticación y permisos

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Backend
    participant DB as Base de datos
    UI->>API: login (email + contrasena)
    API->>DB: valida usuario y sesion unica
    API->>UI: JWT + codigos de permiso
    UI->>UI: guarda permisos en sesion (usePermissions)
    UI->>API: GET /api/... con JWT
    API->>DB: HasPermission (directo o por grupo)
    API->>UI: datos o 403 Permiso requerido
```

Reglas clave:

- **Superusuario** > **permiso directo** > **permiso por grupo**.
- Los permisos se administran en la UI (Roles y permisos) y se exigen en el backend con `HasPermission("<codename>")`; el frontend los refleja con `MODULE_PERMS` (nunca nombres de grupo hardcodeados).
- Las migraciones crean los permisos y los grupos base (`SADMIN`, `ADMIN`, `INST`, `INV`).

## Capturas de pantalla

Las imágenes de la interfaz viven en [`capturas/`](capturas/) y se muestran en el [README](../README.md). Formato sugerido: PNG, 1280px de ancho, nombres `01-login.png`, `02-panel.png`, …

---

← [Volver al README](../README.md) · [Instalación local](instalacion-local.md)
