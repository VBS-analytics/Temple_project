# Temple Project - Claude Reference

## Project Overview

A **temple management and pooja registration system** for a Hindu temple. Handles donor registration, pooja bookings (one-time and recurring), Tamil calendar integration, and payment accounting with passbook generation.

## Tech Stack

### Backend
- **Django 5.0.6** + **Django REST Framework 3.15.1**
- **PostgreSQL 15** (via Docker)
- **JWT Authentication** (djangorestframework-simplejwt 5.3.1)
- **Gunicorn 22.0.0** (production server)
- **skyfield 1.49** + **jplephem 2.21** (Tamil calendar / astronomical calculations)
- **openpyxl 3.1.2** (Excel exports)
- **Pillow 10.3.0** (image processing)

### Frontend
- **React 18.2.0** + **TypeScript 5.4.2**
- **Vite 7.2.4** (build tool)
- **TailwindCSS 3.4.3** (styling)
- **Zustand 4.5.2** (state management)
- **React Router DOM 6.23.1** (routing)
- **React Hook Form 7.71.1** + **Yup 1.4.0** (forms + validation)
- **Axios 1.6.8** (HTTP client)
- **TanStack React Query 5.90.20** (data fetching)
- **PDFMake 0.2.7** + **XLSX 0.18.5** (export)
- **Sonner 2.0.7** (toast notifications)
- **Lucide React 0.563.0** (icons)

### DevOps
- Docker + Docker Compose (3 services: db, backend, frontend)
- Nginx (frontend reverse proxy)

## Repository Structure

```
Temple_project/
├── backend/                    # Django REST API
│   ├── accounts/               # Auth, donors, family
│   ├── pooja/                  # Pooja registration & scheduling
│   ├── payments/               # Payment tracking & reporting
│   ├── common/                 # Shared utilities
│   └── temple_backend/         # Django project config
├── frontend/                   # React TypeScript SPA
│   └── src/
│       ├── pages/              # 20+ page components
│       ├── pages/admin/        # Admin-only pages
│       ├── pages/payments/     # Payment pages
│       ├── components/         # Reusable UI components
│       ├── store/              # Zustand stores
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # API client, utilities
│       ├── utils/              # Helper functions
│       ├── types/              # TypeScript types
│       └── constants/          # App constants
├── docs/                       # Architecture & deployment docs
├── scripts/                    # Backup & deployment scripts
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.production
```

## Django Apps

### accounts/
- **Models:** `User` (custom, phone-based), `OtpToken`, `DonorProfile`, `FamilyMember`, `DonorFeedback`, `GothraOption`
- **Key fields:** `donor_number`, `monthly_donation_amount`, `opening_balance`, `pooja_registration_access`
- **Endpoints:** `/api/auth/` — login, register, OTP, profile, donors list, dashboard metrics

### pooja/
- **Models:** `PoojaOption`, `PoojaDayOption`, `PoojaRegistration`, `PoojaRegistrationMember`, `RecurringPoojaPlan`, `RecurringPoojaPlanMember`, `DailyMessage`, `SpecialAnnouncement`, `DonorMessageTemplate`
- **Key service:** `services/recurrence.py` (41KB) — recurring plan logic, monthly due generation
- **Key service:** `services/calendar.py` (26KB) — Tamil calendar, nakshatra calculations
- **Endpoints:** `/api/pooja/` — options, registrations, recurrence plans, cart snapshots, calendar

### payments/
- **Models:** `PaymentRecord`, `PassbookEntry`, `CombinePaymentMapping`, `Donation`, `ExpenseRecord`
- **Payment modes:** NEFT, UPI, CASH, CARD, AUTO_DEBIT, OTHER
- **Key service:** `services.py` (18KB) — balance calculations, passbook generation
- **Endpoints:** `/api/payments/` — records, passbook, expenses, donations, combine mappings, exports

## Key Frontend Pages

| File | Purpose |
|------|---------|
| `DonorProfile.tsx` (118KB) | Donor dashboard with pooja management |
| `PoojaRegistrationPage.tsx` (175KB) | Pooja selection, cart, registration flow |
| `PaymentStatementPage.tsx` (115KB) | Passbook view, payment history, balance |
| `ReportPage.tsx` (72KB) | Admin reporting interface |
| `FamilyTreePage.tsx` (50KB) | Family structure |
| `KovilDetailsPage.tsx` (53KB) | Temple info pages |
| `RegisterPage.tsx` (89KB) | User registration |
| `pages/payments/PaymentPage.tsx` | Individual payment processing |
| `pages/payments/CombinePaymentPage.tsx` | Group/linked account payments |

## Zustand Stores
- **Auth store** — user login, JWT tokens, profile
- **Cart store** — pooja selections, cart items
- **Payment store** — payment history, balance
- **Combine access store** — linked account permissions

## API Endpoints Summary

### Auth (`/api/auth/`)
`POST /register/`, `POST /login/`, `POST /request-otp/`, `POST /verify-otp/`, `POST /reset-password/`, `GET|PUT /profile/`, `GET /donors/`, `GET /dashboard-metrics/`

### Pooja (`/api/pooja/`)
`/options/`, `/day-options/`, `/registrations/`, `/recurrence/plans/`, `/cart-snapshots/`, `/calendar/day-options/`, `/calendar/tamil-nakshatras/`, `/special-announcements/`, `/daily-messages/`

### Payments (`/api/payments/`)
`/records/`, `/passbook-entries/`, `/expenses/`, `/donations/`, `/combine-mappings/`, `/combine-access/`, `/payment-details-export/`

### System
`GET /health/`, `GET /api/reports/database-download/`

## Data Models (Key Relationships)

```
DonorProfile (1) ──< PoojaRegistration >── PoojaOption
                          │
                          └──< PoojaRegistrationMember

DonorProfile (1) ──< RecurringPoojaPlan >── PoojaOption
                          │
                          └──< RecurringPoojaPlanMember

DonorProfile (1) ──< PaymentRecord
DonorProfile (1) ──< PassbookEntry
DonorProfile (1) ──< CombinePaymentMapping (main_donor / parent_donor)
```

## Django Management Commands
- `generate_monthly_dues` — generate monthly dues (1st of month)
- `process_recurring_poojas` — process recurring pooja schedules
- `backfill_chrt_plans` — backfill historical recurring transactions
- `remove_donor_registrations` — cleanup registrations

## Scripts
- `scripts/db_backup.sh` — database backup
- `scripts/push-backup-to-github.sh` — push backup to repo
- `scripts/setup-backup-cron.sh` — cron job setup

## Git Info
- **Main branch:** `master`
- **Current branch:** `Feb24-updates-3`
- **Total commits:** ~257
- **Recent focus:** Payment module, statement refresh, report filtering

## Important Notes

### User Authentication
- Phone-number-based login (not email)
- OTP verification flow
- JWT tokens for API auth
- Roles: admin vs. regular donor

### Pooja System
- Poojas can be one-time or recurring (monthly / quarterly / annual)
- Group registrations supported (multiple members per registration)
- Day options: weekday, calendar date, Tamil nakshatra (star)
- Cart snapshot system for saving in-progress registrations

### Payment System
- Passbook model: opening balance + monthly dues − payments = closing due
- Combine payments: link multiple donor accounts, pay together
- Multiple export formats: PDF (PDFMake), Excel (XLSX)
- Payment months tracked separately from payment date

### Tamil Calendar
- Nakshatra (star) calculations via skyfield astronomical library
- Day options tied to Tamil calendar dates and stars
- Calendar endpoints return Tamil-specific date metadata

### Known Issues (Security Audit — Feb 2026)
- 38 vulnerabilities identified (7 CRITICAL, 9 HIGH, 12 MEDIUM, 10 LOW)
- Critical: race conditions, NULL crashes, double-charging risk
- See `SECURITY_AND_DATA_INTEGRITY_AUDIT.md` for details

## Common Development Tasks

### Run backend locally
```bash
cd backend
python manage.py runserver
```

### Run frontend locally
```bash
cd frontend
npm run dev
```

### Docker (full stack)
```bash
docker-compose up
```

### Run backend tests
```bash
cd backend
python manage.py test
```

### Generate monthly dues
```bash
python manage.py generate_monthly_dues
```
