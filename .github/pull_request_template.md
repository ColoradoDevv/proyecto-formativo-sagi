## Qué cambia

<!-- Describe el cambio en 2-4 líneas -->

## Por qué

<!-- Motivo: bug, requerimiento, mejora... -->

## Cómo verificarlo

<!-- Comandos o pasos en la UI para comprobarlo -->

## Checklist

- [ ] `poetry run python manage.py check` OK (si toqué backend)
- [ ] `makemigrations --check` sin cambios pendientes (si toqué modelos)
- [ ] `npm run lint` OK (si toqué frontend)
- [ ] Rama actualizada con `dev`, sin conflictos
- [ ] Si agregué permisos: migración + `permissionModules.js` actualizados
- [ ] Sin secretos (`.env`, contraseñas) en el diff
