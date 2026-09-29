#!/usr/bin/env bash
# Backup Postgres SAGI (staging/prod). No imprime secretos.
# Uso: bash scripts/db-backup.sh staging
set -euo pipefail
TARGET="${1:-staging}"
if [[ "$TARGET" != "staging" && "$TARGET" != "prod" ]]; then
  echo "Uso: $0 [staging|prod]" >&2; exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
[[ -f "$ENV_FILE" ]] || { echo "Falta backend/.env (copia backend/.env.$TARGET.example)" >&2; exit 1; }

get_var() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r' | xargs; }
DB_HOST="$(get_var DB_HOST)"; DB_USER="$(get_var DB_USER)"
DB_PASSWORD="$(get_var DB_PASSWORD)"; DB_NAME="$(get_var DB_NAME)"
DB_PORT="$(get_var DB_PORT)"
[[ -n "$DB_HOST" && -n "$DB_USER" && -n "$DB_PASSWORD" ]] || { echo "Faltan DB_* en backend/.env" >&2; exit 1; }
[[ "$DB_PORT" == "6543" ]] && echo "AVISO: puerto 6543 es pooler; pg_dump quiere directa 5432." >&2
case "$DB_HOST" in *pooler*) echo "AVISO: DB_HOST parece pooler; usa db.xxxxx.supabase.co." >&2;; esac

command -v pg_dump >/dev/null || { echo "pg_dump no instalado." >&2; exit 1; }
STAMP="$(date +%Y%m%d-%H%M)"
OUT_DIR="$ROOT/backups"; mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/sagi-$TARGET-$STAMP.dump"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$OUT"
SIZE="$(wc -c < "$OUT" | tr -d ' ')"
[[ "$SIZE" -lt 1024 ]] && { echo "Backup sospechoso ($SIZE bytes): $OUT" >&2; exit 1; }
echo "OK backup $TARGET -> $OUT ($SIZE bytes)"
