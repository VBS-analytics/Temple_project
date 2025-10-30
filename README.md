# Temple Donor Platform

A modern operations suite for the Kakkazhany Gramam temple unifying a content-rich public website with donor and admin workspaces. The repository ships a Vite/React frontend, a Django REST API, and PostgreSQL, orchestrated with Docker for local development.

## Highlights

### Public experience
- Immersive landing page with hero sections, festival highlights, temple timings, visit planner, and live ticker of confirmed pooja registrations pulled from `/pooja/registrations/today-public/`.
- Multi-language toggle (English ↔ Tamil) built on Google Translate with DOM clean-up for a polished UI.
- Dedicated pages for About (founder and committee biographies, family tree downloads), Gallery, Events, and Projects to showcase ongoing initiatives.

### Donor workspace
- Phone-number based authentication with OTP-based registration, password reset, and JWT sessions stored via Zustand.
- Dashboard with donor metrics, today's pooja roster, and one-click PDF exports for admins.
- Profile management with family member directory, gothra/star metadata, and historical pooja registrations.
- Pooja registration flow featuring searchable master data, Tamil-star aware day selection, member multi-select, cart staging, and persistence per user.
- Pooja cart checkout that posts registrations to the API and saves confirmations locally for quick reference.
- Offline payment logging (Form-13) with configurable modes, month tagging, and history table.

### Admin console
- Master data maintenance for pooja headers, pooja options, and day codes with drag-and-drop reordering of day options.
- Donor registry view that groups registrations by donor, surfaces profile data, and allows inline updates.
- Pooja detail explorer with filters, rich table view, XLSX export (via `xlsx`) and PDF export (via `pdfmake`).
- Dashboard KPIs for donor counts and family member totals, plus export of the day's pooja line-up.

### Backend services
- Custom `User` model keyed on `phone_number` with donor/admin roles and auto-generated `DonorProfile.donor_id`.
- OTP token management supporting registration, login, and password reset flows.
- Pooja registration pipeline with sequential `pooja_reg_id`, group member modelling, featured pooja media, and donor-specific message templates.
- Astronomical calendar service powered by `skyfield` + `jplephem` that computes next occurrences for Tamil star and day codes, cached in `backend/data/skyfield`.
- Payment records with mode/status enums ready for future gateway integration and reconciliation.

## Tech Stack

- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS, Zustand, React Hook Form, Axios, pdfmake, xlsx.
- Backend: Django 5, Django REST Framework, Simple JWT, PostgreSQL 15, Skyfield astronomy utilities.
- Tooling: Docker Compose, Gunicorn, PostCSS, ESLint, npm.

## Repository Layout

```text
backend/
  accounts/           # authentication, OTP, donor profiles, family members
  pooja/              # master data, calendar services, registrations, featured content
  payments/           # offline payment tracking
  entrypoint.sh       # container bootstrap (migrations, admin seeding, gunicorn)
  requirements.txt
frontend/
  src/
    pages/            # landing, donor dashboard, admin consoles, static content
    components/       # layouts, language toggle, route guards
    store/            # Zustand stores for auth, cart, registrations, language
    lib/              # axios client, media helpers
  package.json
docs/
  architecture.md     # additional high-level design notes
docker-compose.yml
.env                  # sample development configuration
```

## Getting Started

### Option 1 – Docker Compose (recommended)

```bash
# Update .env with your secrets before first run
docker compose up --build
```

Services exposed:

- Frontend dev server: http://localhost:5173
- Django API + admin: http://localhost:8000 (admin login defaults to `phone_number=9999999999`, `password=adminpass` — change immediately)

### Option 2 – Local runtimes

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Configure PostgreSQL (e.g. docker compose up db) and export env vars matching .env
python manage.py migrate
python manage.py createsuperuser  # optional extra admin
python manage.py runserver 0.0.0.0:8000
```

Frontend:

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

Preview/build commands:

```bash
npm run build   # generates dist/ for static deployment
npm run lint    # react + typescript linting
```

## Environment & Configuration

The repository includes a development `.env`. Key variables:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django cryptographic key |
| `DJANGO_DEBUG` | Toggle Django debug mode |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames for the API |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` | PostgreSQL connection settings |
| `VITE_API_BASE_URL` | Frontend API base (used to define `__API_BASE_URL__` at build time) |
| `TEMPLE_LATITUDE`, `TEMPLE_LONGITUDE`, `TEMPLE_TIME_ZONE` *(optional)* | Override defaults for astronomical calculations |
| `ASTRO_DATA_DIR` *(optional)* | Directory where Skyfield ephemeris files are cached |

`backend/entrypoint.sh` seeds a superuser if one does not exist; rotate credentials in production.

## Backend Notes

- REST endpoints are namespaced under `/api/` (e.g. `/api/auth/login/`, `/api/pooja/registrations/`, `/api/payments/records/`).
- `pooja/services/calendar.py` lazily downloads the `de421.bsp` ephemeris the first time a next-occurrence query runs; ensure the process can write to `backend/data/skyfield`.
- Static and media assets are served from `STATIC_ROOT` / `MEDIA_ROOT`; featured pooja images upload to `media/featured-poojas/`.
- Pagination uses DRF's page-number pagination (`PAGE_SIZE=20`); helper `extractResults` caters to both paginated and list responses.

## Frontend Notes

- Global language toggle renders Google Translate in the background and scrubs default banners via `src/styles/index.css`.
- Auth, cart, and registration state persist in `localStorage` (`temple-auth-store`, `pooja-cart`, `pooja-registrations`).
- Admin pages load data lazily and offer drag-and-drop ordering, inline forms, XLSX/PDF exports, and table filters.
- Landing page fetches featured poojas and today's confirmed/completed registrations to surface live activity.
- Calendar page stitches daily headers and donor message templates for Forms 7–9 reference.

## Data & Workflows

1. Donor signs up via OTP, logs in with password, and maintains profile/family details.
2. Donor selects pooja options, optional Tamil-star day alignments, adds beneficiaries, stages items in cart, and submits registrations (server assigns `PR####` IDs).
3. Payments recorded via `/payments/records/` maintain donor linkage and are visible in the history table.
4. Admin staff curate day codes, featured poojas, and message templates; exports support offline rituals planning.
5. Astronomy service answers next-occurrence queries for Tamil star and weekday codes, enabling accurate scheduling.

## Further Reading

- `docs/architecture.md` — architecture goals, data model overview, and future roadmap.
- `frontend/public/` and `frontend/src/pages/About.tsx` — contains founder/committee bios and family tree references for content editors.

