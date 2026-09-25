<div align="center">

<img src="frontend/src/assets/images/sena/logo-sena-verde-500.png" alt="Logo SENA" width="220" />

# SAGI — Sistema de Gestión de Inventario

**Plataforma institucional para la administración de inventarios, préstamos de materiales, tareas y usuarios.**

![Django](https://img.shields.io/badge/Backend-Django_6-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_19-0B1D26?logo=react)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql&logoColor=white)
![SENA](https://img.shields.io/badge/SENA-Proyecto_formativo-39A900)

</div>

---

## ¿Qué es SAGI?

SAGI es una aplicación web desarrollada como **proyecto formativo del SENA** para digitalizar la gestión de los ambientes de formación: controla qué materiales existen, quién los tiene prestados, en qué estado se devuelven y quién responde por cada movimiento. Todo queda registrado y auditado.

## Características principales

- **Inventario centralizado** — materiales consumibles y devolutivos con marcas, categorías, fotos, fichas técnicas y cotizaciones en PDF.
- **Préstamos con firma digital** — flujo multietapa con aprobación por correo electrónico (código OTP) y documento del solicitante.
- **Devoluciones controladas** — registro de devoluciones, sobrantes y validación del estado del material.
- **Tareas y evidencias** — asignación de tareas a usuarios o grupos, con estados, revisión y archivos de evidencia.
- **Roles y permisos granulares** — más de 70 permisos asignables por grupo o por usuario desde la propia interfaz.
- **Notificaciones configurables** — cada rol elige si la campana muestra préstamos o tareas asignadas.
- **Reportes exportables** — listados en PDF y Excel por módulo.
- **Auditoría completa** — bitácora de quién hizo qué, cuándo y desde dónde.
- **Seguridad** — sesión única por usuario, cambio de contraseña obligatorio, archivos multimedia servidos solo con sesión (Ley 1581 de 2012) y control de acceso en backend y frontend.

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Usuarios** | Registro, edición, activación/desactivación y papelera con restauración |
| **Material consumible** | Ingreso, edición y control de existencias |
| **Material devolutivo** | Registro con placa SENA, serie, fotos y fichas técnicas |
| **Préstamos** | Creación por lote, firmas, seguimiento por estados y devolución |
| **Devoluciones** | Validación del retorno y del estado del material |
| **Cotizaciones** | Biblioteca de PDF para respaldar los materiales |
| **Tareas** | Definiciones, asignaciones, evidencias y revisión |
| **Marcas · Categorías · Inventarios** | Catálogos administrables del sistema |
| **Roles y permisos** | Grupos, permisos individuales y notificaciones |
| **Auditoría** | Consulta de la bitácora del sistema |
| **Panel principal** | Accesos rápidos, actividad reciente y notificaciones |

## Roles y control de acceso

| Rol | Alcance |
|-----|---------|
| **SADMIN** | Acceso total: configuración, roles y permisos |
| **ADMIN** | Gestión de usuarios, materiales, préstamos, reportes y tareas |
| **INST** | Gestión de materiales y préstamos; consulta de cotizaciones |
| **INV** | Solo lectura y gestión de lo propio (sus préstamos y tareas) |

Además se pueden **crear roles personalizados** y asignarles permisos uno a uno, por grupo o por usuario.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Django 6 + Django REST Framework (Poetry) |
| Frontend | React 19 + Vite + Tailwind CSS 4 + TanStack Table |
| Base de datos | PostgreSQL vía Supabase (producción) / SQLite (desarrollo local) |
| Reportes | jsPDF + Excel (xlsx) |

## Estructura del repositorio

```
proyecto-formativo-sia/
├── backend/
│   ├── sia_api/        # Configuración, URLs, seguridad y correo
│   ├── modules/        # users · products · loans · returns · tasks
│   │                   # permissions · audit · home
│   ├── seed_*.py       # Datos iniciales y de demostración
│   └── pyproject.toml  # Dependencias (Poetry)
├── frontend/
│   └── src/
│       ├── app/        # Router y accesos protegidos por permiso
│       ├── features/   # Un módulo por funcionalidad
│       └── shared/     # Componentes, layouts, hooks y servicios
└── docs/               # Documentación del proyecto
```

## Documentación

- [**Instalación local**](docs/instalacion-local.md) — requisitos, backend, frontend y verificación paso a paso.
- [**Arquitectura**](docs/arquitectura.md) — diagrama del sistema, módulos y flujo de autenticación.
- [**Cómo contribuir**](CONTRIBUTING.md) — ramas, commits, PRs y reglas del equipo.

## Puesta en marcha rápida

```bash
# Backend → http://localhost:8000 (API y docs en /docs/)
cd backend && poetry install && poetry run python manage.py migrate
poetry run python manage.py runserver

# Frontend → http://localhost:5173
cd frontend && npm install && npm run dev
```

> El detalle completo (variables de entorno, base de datos, seeds y solución de problemas) está en la [**guía de instalación local**](docs/instalacion-local.md).

---

<div align="center">

**Proyecto formativo — SENA** · Desarrollado por [ColoradoDevv](https://github.com/ColoradoDevv)

</div>
