# AGENTS.md

## Descripcion del proyecto

DSEPC es una plataforma de evaluacion de candidatos para PENSIV. Permite a los
candidatos resolver evaluaciones mediante un codigo de acceso y a los
administradores gestionar bancos de preguntas, plantillas de evaluacion, codigos
de acceso, candidatos, dashboard y reportes.

- **Backend**: FastAPI + SQLAlchemy + SQLite, en `backend/`.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4, en `frontend/`.
- **Lanzador**: `probar_dsepc.bat` arranca ambos servicios y abre el navegador.

## Estructura del proyecto

```
DSEPC/
├── backend/                     # API FastAPI
│   ├── .env                     # Variables de entorno (opcional)
│   ├── dsepc.db                 # Base de datos SQLite (se crea al arrancar)
│   ├── storage/
│   │   ├── excel_exercises/     # Libros de ejercicios practicos cargados
│   │   └── excel_submissions/   # Archivos entregados por candidatos
│   └── app/
│       ├── main.py              # App factory, CORS, migraciones y seed
│       ├── core/                # config.py (Settings) y security.py (JWT)
│       ├── db/                  # session.py (engine/get_db) y base.py (modelos)
│       ├── models/              # Modelos SQLAlchemy
│       ├── repositories/        # Acceso a datos por entidad
│       ├── schemas/             # Esquemas Pydantic (requests/responses)
│       ├── services/            # Logica de negocio por dominio
│       └── api/v1/
│           ├── router.py        # Agrega todos los routers de endpoints
│           └── endpoints/       # Rutas FastAPI por recurso
├── frontend/                    # App React + Vite
│   └── src/
│       ├── app/                 # providers.tsx y router.tsx (rutas)
│       ├── components/          # ui/ (shadcn-style) y shell (app-shell, protected-route)
│       ├── features/            # auth, question-bank, evaluation-templates,
│       │                        # access-codes, candidate-access, admin-dashboard,
│       │                        # reports (cada una con <feature>-service.ts)
│       ├── lib/                 # api-client.ts (axios) y utils.ts
│       └── pages/               # Paginas por ruta
├── plantilla_preguntas_dsepc.xlsx  # Plantilla de importacion de preguntas
├── Ejercicio practico Excel (Captura).xlsx
└── probar_dsepc.bat             # Lanzador de entorno de prueba
```

## Comandos

- **Lanzar el entorno completo** (Windows): ejecutar `probar_dsepc.bat` desde la
  raiz. Inicia backend en `http://127.0.0.1:8000` y frontend en
  `http://127.0.0.1:5173`, valida el healthcheck y abre el navegador.
- **Backend** (desde `backend/`, con el venv `.venv` activado):
  `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
  Documentacion interactiva en `/docs` (OpenAPI).
- **Frontend** (desde `frontend/`): `npm run dev`
- **Lint** (frontend): `npm run lint` (oxlint)
- **Build** (frontend): `npm run build` (`tsc -b && vite build`)
- No hay suite de tests configurada.

## Arquitectura del backend

- **Capas**: `endpoints -> services -> repositories -> models`. Los servicios se
  instancian por request con la sesion de BD (`get_db` de `db/session.py`).
- **Schemas**: Pydantic en `app/schemas/`, alineados 1:1 con los servicios.
- **Autenticacion**: JWT (HS256) en `core/security.py`. Las rutas de admin usan
  `Depends(get_current_admin)`; las rutas de candidato son publicas y se validan
  mediante codigo de acceso.
- **Arranque** (`main.py`): crea tablas (`Base.metadata.create_all`), aplica
  migraciones ad-hoc (`apply_schema_upgrades`, agrega columnas faltantes con
  `ALTER TABLE`) y siembra datos iniciales (`seed_initial_data`: usuario admin y
  codigo de acceso demo).
- **Configuracion**: `core/config.py` usa pydantic-settings; lee `.env` desde
  `backend/`. Valores relevantes: `DATABASE_URL`, `SECRET_KEY`,
  `FRONTEND_ORIGIN`, credenciales admin por defecto (`admin` / `Admin12345`) y
  codigo demo (`EVAL-2026-DEMO`).

## Arquitectura del frontend

- **Rutas**: `src/app/router.tsx` con react-router v7. `/` y `/admin/login`
  son el login de admin; `/candidato` es el portal del candidato; `/admin/*`
  esta protegido por `ProtectedRoute` y envuelto en `AppShell`.
- **API**: `src/lib/api-client.ts` (axios) con base `VITE_API_BASE_URL` o
  `http://127.0.0.1:8000/api/v1`; interceptor que agrega `Authorization: Bearer`.
  Cada feature expone funciones tipadas en `features/<feature>/<feature>-service.ts`.
- **UI**: componentes shadcn-style en `components/ui/`, iconos `lucide-react`,
  alias `@/` -> `src/`.
- **Formularios**: react-hook-form + zod.
- **Persistencia**: localStorage para la sesion de admin (`dsepc.auth.token`,
  `dsepc.auth.user`) y para reanudar sesion de candidato
  (`dsepc.candidate.sessionId`).

## Dominio

- **Banco de preguntas**: categorias, subcategorias y preguntas. Las preguntas
  tienen dificultad (`basic`, `intermediate`, `advanced`) y tipo
  (`multiple_choice`, `excel_practical`). Se importan desde una plantilla Excel
  (`/questions/import` y `/questions/import-template`).
- **Ejercicios practicos de Excel**: el backend analiza la hoja base
  (columnas `MES`, `FOLIOS_UNICO_MES`, `CLAVES_UNICAS_MES`, `Cantidad Surtida`,
  `CLUES UNICOS MES`) y genera un resumen esperado. La validacion de la entrega
  verifica tablas dinamicas, integridad de la hoja base y coincidencia del
  resumen en la hoja de tareas.
- **Plantillas de evaluacion**: secciones (categoria, subcategoria opcional,
  dificultad, cantidad de preguntas, tiempo limite, peso) con preview de validez;
  una plantilla solo puede activarse si tiene suficientes preguntas.
- **Codigos de acceso**: vinculados a una plantilla, con expiracion opcional.
- **Sesiones de candidato**: se generan a partir de la plantilla (seleccion
  aleatoria), registran tiempo por pregunta/seccion y tienen estados
  `pending`, `in_progress`, `completed` y `expired` (cierre automatico por
  timeout). El flujo usa `heartbeat`/`answers` para consolidar tiempo y
  omisiones, y expone metricas por categoria.
- **Dashboard y reportes**: resumen general, promedio por categoria, ranking y
  reportes por sesion. Exportables a Excel (openpyxl) y PDF (reportlab).

## Convenciones

- **Idioma**: identificadores de codigo en ingles; textos de UI y mensajes de
  error (`detail` de `HTTPException`) en espanol sin acentos.
- **Errores**: lanzar `HTTPException` con `status_code` y `detail` descriptivo.
  Los conflictos usan `409`, los no encontrados `404` y los de validacion `400`.
- **Seguridad**: no exponer secretos; las rutas administrativas siempre con
  `get_current_admin`; almacenamiento de archivos bajo `backend/storage/`.
- **Codigo**: mantener las capas (endpoint delgado, logica en servicio, acceso
  a datos en repositorio). No agregar comentarios innecesarios.
