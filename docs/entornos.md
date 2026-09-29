# Entornos de SAGI (P0-1)

Una sola base compartida para todos fue la causa raíz del riesgo de P0-1.
Desde ahora rigen 3 entornos aislados.

## Regla de oro

| Entorno | `DJANGO_ENV` | Base de datos | Datos |
|---|---|---|---|
| dev | `dev` | SQLite local (`db.sqlite3`) | Tus pruebas, se pueden borrar |
| staging | `staging` | Proyecto Supabase STAGING | Desechables, para probar migraciones |
| prod | `prod` | Proyecto Supabase PROD | Reales, con backup diario |

Nunca apuntar dev a PROD. Nunca correr seeds demo contra staging/prod sin avisar.

## Configuración

```bash
# dev (cada persona, SQLite, sin secretos)
cp backend/.env.example backend/.env

# staging (solo quien pruebe el espejo de prod)
cp backend/.env.staging.example backend/.env
# rellenar <COMPLETAR> con valores del proyecto STAGING (gestor de contraseñas)

# prod: NO se crea .env en laptop. Valores por secretos del PaaS.
# Ver backend/.env.prod.example para la lista exacta de variables.
```

`settings.py` es fail-closed por entorno (`backend/sia_api/settings.py`):

* `prod` fuerza `DEBUG=False` aunque el env diga `True`, exige `SECRET_KEY`, `DB_ENGINE=postgresql`, `DB_PASSWORD` y `ALLOWED_HOSTS` real (no solo localhost). Sin eso Django no arranca.
* `staging` exige `SECRET_KEY` y usa `DEBUG=False` por defecto.
* `dev` permite SQLite + fallback de clave solo-dev.

Verificación rápida:

```bash
cd backend
poetry run python manage.py check
DJANGO_ENV=prod poetry run python manage.py check  # debe fallar sin secretos prod: eso es bueno
```

## Qué cambió respecto a antes

* Antes: `.env.example` apuntaba a un único Supabase compartido (`Todos los contribuidores apuntan al MISMO proyecto`). Eso se elimina: cada entorno tiene su proyecto.
* `SECRET_KEY` es una por entorno (generar con `get_random_secret_key`).
* `media/` deja de versionarse (ya hay 16 archivos en git por error: no agregar más; des-versionar con `git rm --cached -r backend/media` cuando el equipo lo apruebe, tras respaldar).

## Rotación de secretos

1. Generar nueva `SECRET_KEY` / `DB_PASSWORD` en Supabase + PaaS.
2. Actualizar secreto en el PaaS (staging primero).
3. Redesplegar staging, correr `migrate` + smoke (`/healthz/`, login, crear préstamo de prueba).
4. Repetir en prod en ventana de bajo uso. Nunca rotar dev/staging/prod a la vez.
