# Instalación local de SAGI

Guía paso a paso para correr el proyecto en tu máquina (Windows, macOS o Linux).
Al final tendrás el **backend en `http://localhost:8000`** y el **frontend en `http://localhost:5173`**.

---

## 1. Requisitos previos

| Herramienta | Versión | Verificación |
|-------------|---------|--------------|
| Python | 3.12.x | `python --version` |
| Poetry | 2.x | `poetry --version` |
| Node.js | 18 o superior | `node --version` |
| Git | cualquiera | `git --version` |

> El backend exige **Python 3.12** (`requires-python = ">=3.12,<3.13"` en `backend/pyproject.toml`).
> Si usas `pyenv` o el instalador oficial, selecciona la 3.12 antes de continuar.

---

## 2. Clonar el repositorio

```bash
git clone https://github.com/ColoradoDevv/proyecto-formativo-sagi.git
cd proyecto-formativo-sia
```

---

## 3. Backend (Django + DRF)

### 3.1. Instalar dependencias

```bash
cd backend
poetry install
```

> Todos los comandos de Django de esta guía se ejecutan con `poetry run` para usar el entorno virtual del proyecto. Si ves `ModuleNotFoundError: No module named 'django'`, es porque olvidaste el prefijo `poetry run`.

### 3.2. Variables de entorno

```bash
cp .env.example .env   # Windows (cmd): copy .env.example .env
```

Abre `backend/.env` y configura:

1. **`SECRET_KEY`** — genera una propia (no reuses la de otro):
   ```bash
   poetry run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```
2. **Base de datos** — elige una opción:
   - **Opción A · SQLite local (recomendada para empezar).** Comenta el bloque Supabase y descomenta:
     ```
     DB_ENGINE=django.db.backends.sqlite3
     DB_NAME=db.sqlite3
     ```
   - **Opción B · Supabase compartido (datos del equipo).** Deja el bloque Supabase y pide la `DB_PASSWORD` por canal privado al dueño del proyecto (nunca por git ni canales públicos).
3. **Correo (opcional).** Sin `EMAIL_*` no pasa nada: los correos (firmas, credenciales) se imprimen en consola.

> El archivo `.env` **nunca** se sube a git (ya está en `.gitignore`).

### 3.3. Migraciones

```bash
poetry run python manage.py migrate
```

Las migraciones crean las tablas **y los datos base**: permisos del sistema y grupos (`SADMIN`, `ADMIN`, `INST`, `INV`).

### 3.4. Crear superusuario

```bash
poetry run python manage.py createsuperuser
```

Sigue las instrucciones en pantalla. Con este usuario entras a la app y al admin de Django (`/admin/`).

### 3.5. Datos de demostración (opcional)

Scripts idempotentes (se pueden correr varias veces sin duplicar). **En este orden:**

```bash
poetry run python seed_document_types.py
poetry run python seed_categories.py
poetry run python seed_demo_data.py      # 10 usuarios + 10 consumibles + 10 devolutivos
poetry run python seed_demo_loans.py     # 10 préstamos de ejemplo
```

Los usuarios demo usan el correo `demo.aprendiz01@sena.edu.co` (…02, …03) y la contraseña temporal definida en el script.

### 3.6. Correr el servidor

```bash
poetry run python manage.py runserver
```

- API: `http://localhost:8000`
- Documentación de endpoints: `http://localhost:8000/docs/`
- Admin de Django: `http://localhost:8000/admin/`

---

## 4. Frontend (React + Vite)

En **otra terminal**:

```bash
cd frontend
npm install
npm run dev
```

Aplicación: `http://localhost:5173`

> El frontend **no necesita archivo `.env`**: Vite redirige `/api` y `/media` al backend (`http://127.0.0.1:8000`) automáticamente. Por eso el backend debe estar corriendo primero.

---

## 5. Verificación

1. Entra a `http://localhost:5173` e inicia sesión (superusuario o usuario demo).
2. Revisa que el menú lateral muestre los módulos según tu rol.
3. En el backend, abre `http://localhost:8000/docs/` y prueba un endpoint (ej. listar usuarios).

---

## 6. Comandos útiles

| Comando | Dónde | Para qué |
|---------|-------|----------|
| `poetry run python manage.py check` | `backend/` | Validar configuración Django |
| `poetry run python manage.py showmigrations` | `backend/` | Ver migraciones aplicadas/pendientes |
| `poetry run python manage.py createsuperuser` | `backend/` | Crear administrador |
| `npm run dev` / `npm run build` / `npm run preview` | `frontend/` | Desarrollo / compilar / previsualizar |
| `npm run lint` | `frontend/` | Verificar código con ESLint |

---

## 7. Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `ModuleNotFoundError: No module named 'django'` | Entorno virtual sin activar | Usa `poetry run` delante del comando |
| `connection failed` a Supabase | `DB_PASSWORD` vacía o pooler saturado | Revisa el `.env`; para `migrate` usa la conexión directa (ver comentarios del `.env`) |
| El frontend muestra "sin conexión" | Backend apagado o en otro puerto | El backend debe correr en el 8000; revisa el proxy en `frontend/vite.config.js` |
| Error de CORS | Origen no permitido | `FRONTEND_URL` y `CORS_ALLOWED_ORIGINS` deben incluir `http://localhost:5173` |
| Puerto 5173 o 8000 ocupado | Otra instancia corriendo | Cierra la otra terminal o usa `--port` (`npm run dev -- --port 5174`) |
| `duplicate key` en tests | Base de pruebas existente | Borra la BD de prueba o corre sin `--keepdb` |

---

← [Volver al README](../README.md)
