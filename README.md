# Temple Donor Platform

A modern operations suite for the Kakkalani Gramam temple unifying a content-rich public website with donor and admin workspaces. The repository ships a Vite/React frontend, a Django REST API, and PostgreSQL, orchestrated with Docker for local development.

## Project Overview

- **Vision**: Provide a single digital hub where temple visitors explore events, donors manage registrations, and administrators orchestrate daily operations.
- **Core modules**:
  - Public site with landing, about, event, gallery, and project pages backed by live pooja registrations.
  - Donor workspace handling account onboarding, family profiles, pooja carts, checkout, and donation history.
  - Admin console for maintaining master data, monitoring KPIs, exporting rosters, and reconciling payments.
- **Technology pillars**: React-based SPA for user experience, Django REST API for business logic, PostgreSQL for data, and Docker for local parity with production.

## How It Works

1. Visitors browse the public microsite to learn about temple history, events, and upcoming poojas.
2. Donors register with their phone number, verify via OTP, and create a password-protected account.
3. Donors curate family profiles, plan poojas using Tamil star/day guidance, and stage items in a cart.
4. Submissions hit the API where sequential registration IDs and donor-specific confirmations are generated.
5. Administrators review registrations, export reports, reorder master data, and record offline payments.
6. Astronomy services cache ephemeris data to answer “next occurrence” queries for Tamil star and weekday calculations.
7. Frontend surfaces real-time updates (ticker, dashboards) using cached API responses and local persistence.

## Feature Highlights

### Public experience
- Immersive landing page with hero sections, festival highlights, temple timings, visit planner, and live ticker of confirmed pooja registrations pulled from `/pooja/registrations/today-public/`.
- Multi-language toggle (English ↔ Tamil) built on Google Translate with DOM clean-up for a polished UI.
- Dedicated pages for About (founder and committee biographies, family tree downloads), Gallery, Events, and Projects to showcase ongoing initiatives.

### Donor workspace
- Phone-number based authentication with OTP registration, password reset, and JWT sessions stored via Zustand.
- Dashboard with donor metrics, today's pooja roster, and one-click PDF exports for admins.
- Profile management with family member directory, gothra/star metadata, and historical pooja registrations.
- Pooja registration flow featuring searchable master data, a curated day-option dropdown for the CHRT selector alongside Tamil-star guidance, member multi-select, cart staging, and persistence per user.
- Pooja cart checkout that posts registrations to the API and saves confirmations locally for quick reference.
- Offline payment logging (Form-13) with configurable modes, month tagging, and history table.

### Admin console
- Master data maintenance for pooja headers, pooja options, and day codes with drag-and-drop reordering of day options.
- Bulk donor upload page (`/admin/bulk-upload`) that imports templated Excel rows, deduplicates by phone number, optionally seeds a default password, and reports created/updated/failed counts after calling `/api/auth/bulk-register/`.
- Inline edit controls for the List of Gothram so administrators can rename entries without touching the database dumps.
- Donor registry view that groups registrations by donor, surfaces profile data, and allows inline updates.
- Pooja detail explorer with filters, rich table view, XLSX export (via `xlsx`) and PDF export (via `pdfmake`).
- Dashboard KPIs for donor counts and family member totals, plus export of the day's pooja line-up.

### Backend services
- Bulk donor import endpoint (`/api/auth/bulk-register/`) that accepts templated rows, skips OTP, applies default or per-row passwords, and returns row-level created/updated/failed statistics.
- Custom `User` model keyed on `phone_number` with donor/admin roles and auto-generated `DonorProfile.donor_id`.
- OTP token management supporting registration, login, and password reset flows.
- Pooja registration pipeline with sequential `pooja_reg_id`, group member modelling, featured pooja media, and donor-specific message templates.
- Astronomical calendar service powered by `skyfield` + `jplephem` that computes next occurrences for Tamil star and day codes, cached in `backend/data/skyfield`.
- Payment records with mode/status enums ready for future gateway integration and reconciliation.

## Tech Stack

- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS, Zustand, React Hook Form, Axios, pdfmake, xlsx.
- Backend: Django 5, Django REST Framework, Simple JWT, PostgreSQL 15, Skyfield astronomy utilities.
- Tooling: Docker Compose, Gunicorn, PostCSS, ESLint, npm.

## Core Logic & Process

- **Authentication**: Phone numbers are the primary identity key. OTP tokens validate sign-up/sign-in, and Simple JWT issues access/refresh pairs stored by the frontend in Zustand stores with localStorage persistence.
- **Donor Profiling**: Each authenticated user auto-spawns a `DonorProfile` (`donor_id` generated sequentially). Profiles maintain gothram, star, and family member references that downstream flows reuse.
- **Pooja Catalog**: Administrators curate pooja headers/options with metadata (pricing, Tamil star relevance, scheduling rules). The frontend fetches this catalog and caches it for quick search/filter operations.
- **Cart & Checkout**: Donors stage pooja selections in a client-side cart. Submissions hit `/api/pooja/registrations/`, which assigns sequential `PR####` IDs, persists member mappings, and returns confirmation payloads stored locally for offline reference.
- **Astronomy Scheduling**: `pooja/services/calendar.py` calculates the next valid date for Tamil star/day combinations via Skyfield ephemeris data and caches results under `backend/data/skyfield` to avoid repeat downloads.
- **Payments & Reconciliation**: Offline payments (Form-13) register via `/api/payments/records/`. Records track mode/status enums, amounts, and donor linkage, enabling admins to reconcile pending balances within the console.
- **Dashboards & Exports**: Admin dashboards aggregate donor totals, registration counts, and member breakdowns. Exports leverage `xlsx` and `pdfmake` to generate printable rosters and receipts on demand.

## Execution Cheat Sheet

| Task | Command |
| --- | --- |
| Start full stack (recommended) | `docker compose up --build` |
| Run backend locally | `python manage.py runserver 0.0.0.0:8000` |
| Run frontend locally | `VITE_API_BASE_URL=http://localhost:8000/api npm run dev` |
| Build frontend for production | `npm run build` |
| Lint frontend code | `npm run lint` |
| Apply backend migrations | `python manage.py migrate` |
| Create Django superuser | `python manage.py createsuperuser` |

### Import donor opening balances
When you receive a donor opening-balance workbook (for example, `opening-balance-december.xlsx`), run the new management command to seed each donor's `DonorProfile.custom_number` before reconciling payments:

```bash
python manage.py import_opening_balances opening-balance-december.xlsx
```

Use `--dry-run` to validate that the sheet parses cleanly without mutating data, `--sheet` to specify an alternate tab, or `--name-column`/`--phone-column`/`--balance-column` when your headers differ. The command matches donors by phone digits (falling back to the last ten digits for formatting differences) and reports any rows it could not match so you can resolve them before persisting.

The backend entrypoint supports running `import_opening_balances` (using `/app/opening-balance-december.xlsx` by default) before regenerating passbooks, but startup import is disabled by default to prevent accidental balance rewrites during routine redeploys. Enable it only when needed with `RUN_STARTUP_JOBS=1`, and override the workbook path with `OPENING_BALANCE_WORKBOOK=/path/to/your.xlsx` when you need a different file.

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

## Step-by-Step Setup

### Prerequisites
1. Install Docker/Docker Compose **or** Python 3.11+, Node.js 18+, and PostgreSQL 15.
2. Copy `.env` to a local environment file and populate secrets (see [Environment & Configuration](#environment--configuration)).
3. Ensure ports `5173` (frontend) and `8000` (backend) are free on your machine.

### Option 1 – Docker Compose (recommended)
1. From the repository root, review `docker-compose.yml` to understand service names (`web`, `api`, `db`).
2. Update `.env` with database credentials, Django secrets, and the desired API base URL.
3. Run:
   ```bash
   docker compose up --build
   ```
4. Wait for the backend container to apply migrations and seed the default admin user (`phone_number=9999999999`, `password=adminpass` — change immediately after login).
5. Visit:
   - Frontend dev server: http://localhost:5173
   - Django API + admin: http://localhost:8000

### Option 2 – Local runtimes

#### Backend
1. Create and activate a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # .venv\Scripts\activate on Windows
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Provision PostgreSQL and export environment variables matching `.env`.
4. Apply migrations and optionally seed an extra admin:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser  # optional
   ```
5. Run the API:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

#### Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Point the SPA at your API:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000/api npm run dev
   ```
3. For production-style bundles:
   ```bash
   npm run build   # generates dist/ for static deployment
   npm run lint    # react + typescript linting
   ```

### Post-Setup Checks
1. Load http://localhost:5173 and confirm the landing page renders with live ticker data.
2. Sign in using the seeded admin credentials and verify dashboard metrics populate.
3. Create a donor account, complete an OTP flow, and submit a sample pooja registration.
4. Confirm the admin console reflects the new registration and exports generate PDFs/XLSX.

## Operational Workflows

### Donor Journey
1. **Discover**: Browse the landing page, upcoming events, and temple timings.
2. **Onboard**: Sign up with phone number, validate the OTP, and set a password.
3. **Curate Profile**: Add family members, gothra, and star details for scheduling guidance.
4. **Plan Poojas**: Search master data, filter by Tamil star/day, and stage items in the cart.
5. **Checkout**: Submit the cart, receive sequential `PR####` confirmation, and view history.
6. **Follow Up**: Track payment status, download receipts, and manage future registrations.

### Admin Operations
1. **Dashboard**: Review daily KPIs for donor counts, registrations, and payments.
2. **Master Data**: Maintain pooja headers/options and reorder day codes via drag-and-drop.
3. **Bulk Upload**: Use `/admin/bulk-upload` to onboard donors from Excel, deduplicate entries, and surface row-level outcomes before new accounts hit the roster.
4. **Registration Review**: Filter by date, download XLSX/PDF reports, and reconcile offline payments.
5. **Payments**: Record Form-13 entries with mode/status enums and track outstanding balances.
6. **Content**: Update featured pooja media, gallery assets, and about page biographies as needed.
7. **Astronomy Cache**: Monitor `backend/data/skyfield` for ephemeris freshness (downloads happen on demand).

### Back-Office Checklist
1. Ensure database backups run nightly and store offsite.
2. Rotate default admin credentials after first login.
3. Audit OTP delivery logs to maintain SMS reliability.
4. Review donor feedback and update landing page highlights accordingly.

## Development Workflow
- **Plan**: Capture features/issues in `docs/architecture.md` or your task tracker.
- **Branch**: Create feature branches from `main` (e.g., `feature/donor-reports`).
- **Develop**: Run `npm run dev` and `python manage.py runserver` side-by-side for rapid iteration.
- **Test**: Add unit tests (frontend with Vitest, backend with Django’s test runner) and run linting before commits.
- **Review**: Use pull requests for peer review, referencing API contracts and UI mockups.
- **Deploy**: Build frontend assets (`npm run build`), run backend migrations, and restart services with Docker or your target environment.

## Deployment Notes
- **Staging**: Mirror Docker compose in a staging environment to validate end-to-end changes before production.
- **Environment Variables**: Store secrets in a managed vault and inject at runtime; do not commit `.env`.
- **Static Assets**: Serve `frontend/dist` via a CDN or static host; configure Django to serve only API endpoints.
- **Monitoring**: Enable logging for OTP, payments, and calendar services; alert on API error spikes and failed ephemeris downloads.
- **Uptime keep-alive**: Prevent platform spin-down by configuring a free HTTP(s) monitor with UptimeRobot (create a free account, add a monitor pointing to `https://temple-project-1.onrender.com/`, set the check interval to 5 or 10 minutes, and save); the service will ping the URL regularly and provide uptime insights without code changes.

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

## Payment Module Overview

The Payment Module handles all payment tracking, statement generation, and payment processing:

### Payment Statement Page
- **Donor View**: Personal passbook showing payment history with running balance
- **Admin View**: Multi-donor passbook with phone numbers and complete payment tracking
- **Recurring Poojas**: Automatically shows 1st of each month for 12 months (e.g., 01/01/2026, 01/02/2026, etc.)
- **One-time Registrations**: Shows current date
- **Filters**: By donor name, month, and payment status
- **Exports**: PDF and Excel download options

### Payment Tracking
- **Opening Balance**: Displayed as first entry (31/12/2025)
- **Pooja Due**: Amount due for registered poojas
- **Paid Amount**: Payment received against dues
- **Closing Balance**: Running balance = Opening + Due - Paid

### Payment Processing
- **Payment Page**: Donors submit payments with UPI links and manual transfer details
- **Combined Payment**: Multiple linked donor accounts can make single unified payments
- **Payment Recording**: Track payment reference, date, and amount
- **Payment History**: View all past payments and current dues

For detailed documentation, see `docs/PAYMENT_MODULE.md`.

## Further Reading

- `docs/architecture.md` — architecture goals, data model overview, and future roadmap.
- `frontend/public/` and `frontend/src/pages/About.tsx` — contains founder/committee bios and family tree references for content editors.
