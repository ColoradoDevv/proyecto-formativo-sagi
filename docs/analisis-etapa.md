# Análisis de etapa del software — SAGI

> **Fecha:** 25 de septiembre de 2026
> **Base analizada:** `dev` + ramas de documentación e higiene (`docs/documentacion`, `chore/repo-hygiene`)
> **Método:** auditoría por líneas en backend, frontend y operación, con verificación directa de los hallazgos más graves.
> **Veredicto: MVP avanzado / beta funcional (~65% del camino). Bueno para demo, NO listo para producción. Nota global: 4/10 para producción.**

| Dimensión | Nota | Estado |
|-----------|------|--------|
| Backend (Django + DRF) | 4/10 | Funcional, con huecos de seguridad y sin observabilidad |
| Frontend (React + Vite) | 6/10 | Sólido en UI, con 4 fallos puntuales graves |
| Operación / producto | 3/10 | Sin deploy, sin backups, BD compartida |

---

## 1. Fortalezas reales (lo que sí está bien)

- **RBAC granular funcionando:** 75 permisos en BD, asignables por grupo o por usuario desde la propia UI, con notificaciones excluyentes. Sin permisos huérfanos (verificado `HasPermission` vs migraciones `0002`–`0016`).
- **Autenticación seria:** sesión única por usuario (`active_session_jti`), blacklist de tokens con limpieza, OTP con expiración e intentos máximos, logout que invalida.
- **Validación de archivos:** tipo, tamaño y verificación real con Pillow (`sia_api/file_validation.py`).
- **Media protegida:** servida solo con sesión y anti-traversal (`sia_api/media_views.py`), coherente con Ley 1581 de 2012.
- **Frontend disciplinado:** rutas por permiso (`RequirePerms` + `MODULE_PERMS`), validación con zod (11 schemas), submits con estado de carga, responsive y accesibilidad base (skip-link, focus-trap, títulos por página), code-splitting por ruta.
- **Cero TODOs/FIXME** reales en el código y `console.*` limitados a 6 `console.error` en catches.

---

## 2. Bloqueadores de producción (críticos)

### 2.1. Secretos y configuración insegura
- `backend/sia_api/settings.py:29` — `SECRET_KEY` con fallback público (`'dev-secret-key-change-me-in-production'`). Si falta la variable en prod, arranca igual con clave conocida.
- `backend/.env.example:17` — trae `DEBUG=True` listo para copiar a producción (expone tracebacks).
- `backend/.env.example:34,36,41` — referencia del proyecto Supabase trackeada en git (facilita ataques dirigidos).
- `backend/seed_demo_data.py:26` — `TEMP_PASSWORD="Sgi*2026"` + 10 cuentas demo en el historial de git.

### 2.2. Sin endurecimiento web ni observabilidad
- Ausencia total en `settings.py` de `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`, `SECURE_SSL_REDIRECT` y `LOGGING` (verificado: 0 hits).
- JWT de 8h sin rotación, aceptando tokens viejos sin `scope` y viajando en `?auth=` (queda en logs, historial y `Referer`).
- Sin Sentry, sin `/healthz`, sin página de estado. Solo CodeQL en CI.

### 2.3. Sin artefacto de despliegue
- No hay Dockerfile, compose, gunicorn/uvicorn, `STATIC_ROOT`, `collectstatic` ni whitenoise. `vite preview` no es servidor de producción.
- Throttling y paginación DRF ausentes: listados sin tope.

### 2.4. Datos frágiles
- Todos los desarrolladores apuntan al **mismo Supabase** con usuario `postgres`, sin backups ni procedimiento de restore.
- Media en disco local (`MEDIA_ROOT`): se pierde en cualquier PaaS efímero.
- Seeds operativos (`seed_document_types.py`, `seed_categories.py`) son scripts sueltos, no migraciones: una BD fresca de producción **no puede operar** (categoría y tipo de documento son FK obligatorias).

### 2.5. Build no reproducible
- `zod` y `html2canvas` se importan (12 archivos + `manualChunks` de Vite) pero **no están declarados** en `frontend/package.json`. Un `npm ci` limpio puede romper el build.

### 2.6. Red de seguridad del frontend
- Sin Error Boundary: un crash de render = pantalla blanca total.
- Sin página 404 (`router.jsx` sin `path="*"`): URLs inválidas quedan en blanco.
- `/auditoria` sin `RequirePerms` aunque su comentario dice "solo superadministrador primigenio".
- Reportes que vuelcan el dataset completo en memoria (sin paginación ni límite).

---

## 3. Pendientes altos y medios

**Seguridad y backend**
- Rate-limit solo en login/recuperación; correos síncronos (un SMTP caído puede tumbar el request con 500).
- `delete_inventory` y `delete_category` son permisos muertos: el `destroy` exige solo `IsSuperUser` (`products/views.py:83-84,106-107`).
- Auditoría ciega en tareas, categorías, inventarios y cotizaciones (sin `AuditMixin` ni signals).
- `TIME_ZONE='UTC'` y `LANGUAGE_CODE='en-us'` sin localizar (`es-co` / `America/Bogota`); typo `locahost` en `settings.py:39`.

**Frontend**
- `alert()` nativo en `ReportModal.jsx:86` (ya existe librería de alertas).
- `xlsx@0.18.5` desactualizado; restos de nombres de grupo hardcodeados (`isAdmin === "ADMIN"`, filtros `SADMIN` solo-cliente).
- `features/groups/` y `features/permissions/` vacíos; mock `returnable-materials.js` huérfano.

**Operación y producto**
- Sin `LICENSE` (derechos reservados por defecto: bloquea reutilización).
- `main` sin releases; `task/tre` (+2400 líneas) y `task/two` con trabajo sin mergear.
- Sin runbook de producción (deploy, migrate, backup/restore, rotación de `SECRET_KEY`, rollback).
- Borrado lógico solo en usuarios; el resto es borrado físico o desactivación, sin política de retención.

---

## 4. Roadmap a producción

**Fase 0 — higiene (días):** mergear ramas de docs, rotar secretos, `LICENSE`, seeds operativos → data migrations, `CONN_MAX_AGE=0` con pooler.

**Fase 1 — desplegable y seguro (1–2 semanas):** `SECRET_KEY` obligatorio (fail-closed), `DEBUG` validado, `SECURE_*`, Dockerfile/compose + `migrate` en release, media en S3 o volumen persistente, backups + restore probado, un entorno de BD por ambiente.

**Fase 2 — calidad (2–3 semanas):** declarar dependencias fantasma, 404 + Error Boundary, guard en `/auditoria`, tests en módulos vacíos + CI con tests y build, auditoría de tareas, reportes acotados, LOGGING + Sentry + `/healthz`, política de privacidad propia.

**Estimación realista:** 4–6 semanas a ritmo de equipo formativo para un pase a producción mínimo y defendible.

---

← [Volver al README](../README.md)
