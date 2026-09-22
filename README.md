# Proyecto Formativo SGI

Sistema de Gestión de Inventario (SGI) para la gestión de inventario, préstamos de materiales y usuarios dentro de una institución educativa (SENA).

## Stack tecnológico

**Backend** — Django 6 + Django REST Framework + Poetry  
**Frontend** — React 19 + Vite + Tailwind CSS + TanStack Table  
**Base de datos** — SQLite (desarrollo) / PostgreSQL (producción)

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Autenticación** | Login y control de sesión |
| **Usuarios** | CRUD de usuarios, roles y tipos de documento |
| **Material Consumible** | Registro y listado de materiales que se consumen |
| **Material Devolutivo** | Registro y listado de materiales que se devuelven |
| **Préstamos** | Registro y seguimiento de préstamos de materiales |
| **Retornos** | Registro de devoluciones de préstamos |
| **Marcas** | Gestión de marcas de productos |
| **Grupos y Permisos** | Control de acceso por roles |

## Estructura

```
proyecto-formativo-sia/
├── backend/
│   ├── sia_api/           # Configuración principal de Django
│   ├── modules/
│   │   ├── users/         # Usuarios, roles, tipos de documento
│   │   ├── products/      # Materiales consumibles y devolutivos
│   │   ├── loans/         # Préstamos
│   │   ├── returns/       # Retornos
│   │   └── tasks/         # Tareas
│   ├── manage.py
│   └── pyproject.toml
│
└── frontend/
    └── src/
        ├── app/           # Router y configuración principal
        ├── features/      # Módulos por funcionalidad
        ├── shared/        # Componentes, layouts y hooks reutilizables
        ├── services/      # Clientes de API
        └── assets/        # Imágenes y recursos estáticos
```

## Instalación

### Requisitos previos

- Python 3.11+
- Poetry
- Node.js 18+

### Backend

```bash
cd backend
poetry install
cp .env.example .env   # Configurar variables de entorno
python manage.py migrate
python manage.py runserver
```

La API quedará disponible en `http://localhost:8000`.  
La documentación de endpoints en `http://localhost:8000/docs/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación quedará disponible en `http://localhost:5173`.

## Variables de entorno

El backend usa **Supabase (Postgres)**. Cada contribuidor crea su propio `backend/.env` (nunca se comparte el archivo, está en `.gitignore`):

```bash
cd backend
cp .env.example .env   # Windows: copy .env.example .env
```

Luego rellena los `<COMPLETAR>` del `.env` (las instrucciones están dentro del propio archivo):
- `SECRET_KEY`: genera una propia, no reuses la de otro.
- `DB_PASSWORD` y `DB_USER`: pídelas por canal privado al dueño del proyecto Supabase, o crea tu propio proyecto gratis en `supabase.com`.
- Sin configurar correo no pasa nada: los mails se imprimen en consola.

```bash
python manage.py migrate
python manage.py runserver
```

## Scripts del frontend

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilar para producción |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Verificar código con ESLint |

---

> Proyecto formativo — [ColoradoDevv](https://github.com/ColoradoDevv)
