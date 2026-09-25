# Cómo contribuir a SAGI

Guía del flujo de trabajo del equipo. Leer antes del primer aporte.

## 1. Ramas

- **`dev`** es la rama base: todo PR apunta a `dev`. Nunca se commitea directo a `dev` ni a `main`.
- Crea tu rama desde `dev` actualizado:
  ```bash
  git checkout dev && git pull
  git checkout -b <tipo>/<descripcion-corta>
  ```
- Prefijos: `feat/` (funcionalidad), `fix/` (corrección), `docs/` (documentación), `chore/` (tareas), `refactor/`, `perf/`, `style/`, `test/`.

## 2. Commits

Formato: `<tipo>: <descripción en minúscula y en español>`.

```bash
git commit -m "feat: campana de notificaciones por permiso"
git commit -m "fix: icono del calendario sobre la fecha del modal"
git commit -m "docs: guia de instalacion local"
```

- Un commit = un cambio lógico. No mezcles funcionalidad con formato.
- Revisa antes de commitear: `git status`, `git diff --stat`.
- Solo se suben los archivos del cambio; nada de `.env` (está en `.gitignore`).

## 3. Antes de abrir el PR

```bash
# Backend (desde backend/)
poetry run python manage.py check
poetry run python manage.py makemigrations --check --dry-run

# Frontend (desde frontend/)
npx eslint <archivos tocados>
```

- Actualiza tu rama con `dev` (`git merge origin/dev`) y resuelve conflictos localmente.
- El diff del PR debe contener **solo** tu cambio.

## 4. Pull Requests

- Base `dev`, título con el mismo formato de commits.
- Describe **qué** cambia y **por qué**; incluye cómo verificarlo (comandos o pasos en la UI).
- Si el PR agrega permisos nuevos: incluir la migración que los crea **y** actualizar `frontend/src/features/access/constants/permissionModules.js`.

## 5. Secretos y datos

- Jamás commitear `.env`, contraseñas ni `DB_PASSWORD`: se comparten por canal privado.
- Cada persona genera su propia `SECRET_KEY` (ver [instalación local](docs/instalacion-local.md)).
- Los seeds son idempotentes, pero **no** se corren contra la base compartida sin avisar al equipo.

## 6. Convenciones del código

- Backend: Django + DRF; los endpoints nuevos declaran su permiso con `HasPermission("<codename>")`.
- Frontend: las rutas se protegen con `RequirePerms` + `MODULE_PERMS`; no hardcodear nombres de grupo, usar permisos.
- Los textos de la UI van en español.
