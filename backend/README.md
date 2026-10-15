# Backend — SAGI API (`backend/`)

Django 6 + DRF + Poetry (`requires-python >=3.12,<3.15`, `pyproject.toml:9`). `AUTH_USER_MODEL="users.User"` (`sia_api/settings.py:115`). Esta guía expone **todo el backend por nombre** (módulos, endpoints, comandos, variables) sin publicar valores secretos.

## Dependencias (`pyproject.toml:10-28`)

`django>=6.0.3`, `djangorestframework>=3.16.1`, `django-cors-headers`, `coreapi` (docs `/docs/` título `SGI API`), `django-filter`, `pillow`, `python-dotenv` (+ `dotenv`), `psycopg2-binary`, `pyjwt`, `sentry-sdk`, `gunicorn`, `whitenoise`, `pyotp`, `qrcode`, `cryptography`, `setuptools==81.0.0`, `legacy-cgi`.

## Estructura

```
backend/
├── manage.py                      # load_dotenv + entrypoint
├── pyproject.toml / poetry.lock / poetry.toml (in-project .venv)
├── sia_api/
│   ├── settings.py                # DJANGO_ENV dev|staging|prod fail-closed, DB, DRF global, CORS/CSRF, correo consola, logs, Sentry
│   ├── urls.py                    # admin/, docs/, media con auth, api/users|permissions|products|loans|returns|tasks|audit + home
│   ├── media_views.py             # AuthenticatedMediaView (Ley 1581)
│   ├── emailing.py / file_validation.py / schema.py (TolerantAutoSchema para /docs/)
│   └── wsgi.py / asgi.py
├── modules/
│   ├── users/        # User (email login), DocumentType, PasswordChangeOTP, BlacklistedToken, MFADevice+RecoveryCode, JWTAuthentication, mfa.py
│   ├── permissions/  # Permission/Group/GroupPermission/UserPermission/UserGroup/SolicitudCambioRol, services, ranking, elevation, authority
│   ├── products/     # Brand/Inventory/Category/ConsumableMaterial/ReturnableMaterial/TechnicalSheet/Quotation
│   ├── loans/        # Loans, LoanDraft (TTL 24 h), SignOTP; LoanViewSet + flujo draft/sign + batches
│   ├── returns/      # LoanReturn (leftover/returned, Bueno|Mantenimiento|Baja)
│   ├── tasks/        # TaskDefinition/TaskAssignment(scope user|group)/TaskEvidence
│   ├── audit/        # AuditLog solo lectura (solo is_primary_admin)
│   └── home/         # index, HealthCheckView (/healthz/), DashboardSummaryView, SupportEmailView
├── templates/        # emails: firmas, credenciales, tareas
├── tests/ + tests por módulo (users/tests.py: UserSerializerTests, MFATestCase; resto por módulo)
├── seed_document_types.py / seed_categories.py / seed_demo_data.py / seed_demo_loans.py (idempotentes, en ese orden)
├── .env.example / .env.staging.example / .env.prod.example (plantillas; el .env real está en .gitignore)
└── media/            # archivos subidos (NO versionar nuevos; hay 16 históricos por error)
```

## Arranque y comandos

```bash
cd backend
poetry install
cp .env.example .env   # Windows: copy .env.example .env (rellena SECRET_KEY y MFA_ENCRYPTION_KEY)
poetry run python manage.py migrate
poetry run python manage.py createsuperuser
poetry run python seed_document_types.py
poetry run python seed_categories.py
poetry run python seed_demo_data.py
poetry run python seed_demo_loans.py
poetry run python manage.py runserver   # http://localhost:8000
```

Útiles: `check`, `showmigrations`, `makemigrations --check --dry-run` (exigido en PRs), `shell -c "…conteos…"`, management `cleanup_blacklisted_tokens.py`, `mfa_reset.py`, `migrate_roles_to_groups.py`.

URLs base: API `http://localhost:8000` · `/docs/` · `/admin/` · `/healthz/` · `/media/<path>` (con JWT).

## Auth / permisos (resumen; detalle en `docs/endpoints.md` y `docs/roles-permisos.md`)

- JWT propio HS256 `Bearer`: login 8 h, reset 15 min, firma 4 h (`scope=loan_sign`), MFA 5 min (`scope=mfa`). Sesión única (`jti` vs `active_session_jti`), blacklist SHA-256, `is_deleted/is_active`.
- Global: `IsAuthenticated + NotBlockedByPasswordChange`. Por acción: `HasPermission("<codename>")`. TOTP (`pyotp`, ventana 1) + 10 recovery codes; secretos cifrados Fernet.
- OTPs (password y firma): SHA-256, TTL 10 min, 5 intentos, rate-limit.

## Variables de entorno (solo NOMBRES — los valores nunca se publican)

| Variable | Entornos | Notas |
|----------|----------|-------|
| `DJANGO_ENV` | dev/staging/prod | `dev` SQLite+fallback; `staging` exige `SECRET_KEY`; `prod` fail-closed |
| `SECRET_KEY` | las 3 (una por entorno) | `get_random_secret_key`; obligatoria salvo dev+DEBUG |
| `MFA_ENCRYPTION_KEY` | las 3 (una por entorno) | `Fernet.generate_key()`; si cambia invalida MFAs |
| `DEBUG` | dev `True`, staging/prod `False` (prod fuerza `False`) | — |
| `ALLOWED_HOSTS` | todas (prod exige dominio real) | coma-separada |
| `TRUSTED_PROXIES` | opcional | solo IP del proxy propio (nginx) |
| `DB_ENGINE/DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT` | dev SQLite; staging/prod Postgres | pooler `6543`, directa `5432` para `migrate`/`pg_dump`; `CONN_MAX_AGE` (default 0) |
| `FRONTEND_URL/CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS` | todas | incluir origen del front |
| `STATIC_ROOT` | prod | default `staticfiles/` (WhiteNoise) |
| `LOG_LEVEL` | todas | `DEBUG/INFO/WARNING` |
| `SENTRY_DSN` | staging/prod | vacío = desactivado |
| `EMAIL_BACKEND/HOST/PORT/USE_TLS/HOST_USER/HOST_PASSWORD/DEFAULT_FROM_EMAIL` | todas | sin esto → consola |

Ver `docs/entornos.md` y las 3 plantillas `.env.*.example`.
