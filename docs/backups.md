# Backups y restore de SAGI (P0-1)

Supabase hace snapshots automáticos, pero **no son tu plan de backup**:
no sabes cuándo fueron, no los has restaurado nunca y no cubren `media/`.
Este runbook define el mínimo verificable.

## Alcance

* Cubierto: Postgres de staging/prod (vía `pg_dump` formato custom).
* No cubierto (siguiente paso P0-2): `media/` en disco. Hoy vive en `backend/media/` y hay 16 archivos versionados en git por error. Respáldalo aparte (zip fechado) hasta migrar a S3/Storage.

## Backup manual (antes de cualquier `migrate` en staging/prod)

Windows (PowerShell):

```powershell
.\scripts\db-backup.ps1 -Env staging
```

Linux/macOS:

```bash
bash scripts/db-backup.sh staging
```

El script lee `backend/.env` (nunca imprime `DB_PASSWORD`), usa la conexión
DIRECTA (`db.xxxx.supabase.co:5432`, no el pooler `6543`), genera
`backups/sagi-staging-YYYYMMDD-HHMM.dump` y falla si el archivo queda vacío.

> Si tu `.env` apunta al pooler (6543), el script te lo advierte: para `pg_dump`
> cambia temporalmente a la conexión directa (ver comentarios del `.env.staging.example`).

## Restore (solo staging salvo emergencia real)

```bash
# 1. Avisar al equipo y congelar escrituras (poner mantenimiento si aplica).
# 2. Restaurar a una DB temporal primero, nunca directo a prod sin probar.
pg_restore --clean --if-exists -h <DB_HOST_DIRECTO> -U <DB_USER> -d postgres backups/sagi-staging-YYYYMMDD-HHMM.dump

# 3. Verificar Django contra la DB restaurada:
cd backend
poetry run python manage.py check
poetry run python manage.py showmigrations --plan | head
poetry run python manage.py shell -c "from modules.users.models import User; from modules.loans.models import Loans; print('users:', User.all_objects.count(), 'loans:', Loans.objects.count())"
```

Criterio de éxito: `check` en verde, conteos > 0 y login + `/healthz/` responden.

## Rutina semanal (dueño del proyecto, 15 min)

1. Lunes: backup manual de prod + staging (`backups/` con fecha).
2. Verificar tamaño > 1MB y fecha del archivo (un dump de 0 bytes = fallo silencioso).
3. Una vez al mes: restore a proyecto Supabase temporal + `check` + conteos. Registrar fecha y resultado en el PR/issue de seguimiento.
4. Antes de cada release: backup + `makemigrations --check` en CI verde.

## Qué hacer si el backup falla

* `connection failed` → estás usando el pooler (6543) o `DB_PASSWORD` vacía: cambia a conexión directa (5432) solo para el dump.
* `pg_dump: command not found` → instala PostgreSQL client tools (Windows: `winget install PostgreSQL.ClientTools`, o usa el SQL Editor de Supabase como respaldo manual).
* Dump de 0 bytes → no lo borres, genera otro con sufijo `-retry` e investiga; nunca encadenes un `migrate` sobre un backup fallido.
