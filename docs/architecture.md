# Temple Management Platform - Architecture Overview

## Goals
- Allow donors to register, authenticate, and manage pooja bookings.
- Give admins interfaces to maintain master data (pooja options, daily messages, donor metadata).
- Support workflow for OTP-based sign-up, password reset, and donor group registrations.
- Provide reporting views for daily pooja schedules and donor-specific texts.
- Prepare for future integration with payment gateway while tracking payment history.

## High-Level Architecture
```
┌──────────┐    REST/JSON    ┌─────────────┐    SQL    ┌──────────────┐
│ React UI │  <------------> │ Django API  │ <-------> │ Postgres DB  │
└──────────┘                 └─────────────┘           └──────────────┘
        ▲                           ▲                         ▲
        │  Docker network           │                         │
        └───────────── docker-compose orchestrates ───────────┘
```
- `frontend`: React + React Router + Zustand (lightweight state) + axios for API calls.
- `backend`: Django + Django REST Framework + PostgreSQL + JWT auth (simple JWT).
- `db`: PostgreSQL 15 with named volumes for persistence.

## Major Backend Components
- **Accounts app**: donor/admin user model (phone-number based login), OTP flow scaffold.
- **Pooja app**: master data tables, registrations, daily schedule generator.
- **Payments app**: placeholder models for recording payment attempts, ready for gateway integration.

### Data Model (initial)
- `User` (custom, extends `AbstractBaseUser`): `phone_number`, `name`, `address`, `role`, `is_active`.
- `OtpToken`: store OTP verifications (pending/verified, expiry).
- `PoojaOption`: canonical list (code, description, cost type).
- `PoojaDayOption`: mapping for day codes / Tamil star master.
- `DailyMessage`: templated daily header text keyed by day code or weekday.
- `DonorProfile`: extended data such as gothra, star, preferences.
- `PoojaRegistration`: donor bookings, recurrence flags, group support.
- `PoojaRegistrationMember`: participants when group booking is true.
- `PaymentRecord`: amount, mode, month, status, integration ref.

### API Surface (summary)
- Auth: `POST /api/auth/register`, `/api/auth/login`, `/api/auth/request-otp`, `/api/auth/verify-otp`, `/api/auth/reset-password`.
- Master data: CRUD for pooja options, day options, daily messages (admin only).
- Donor flows: `GET /api/donor/profile`, `PUT /api/donor/profile`, `POST /api/donor/pooja-registrations`, `GET /api/donor/pooja-registrations`, `GET /api/donor/daily-schedule`.
- Payments: `POST /api/payments/initiate` (placeholder), `GET /api/payments/history`.

## Frontend Structure
- Routing using React Router with nested layout: `/login`, `/register`, `/otp`, `/dashboard`, `/admin/*`.
- Shared state using Zustand for auth tokens & user data.
- Forms built with React Hook Form + Yup validation.
- UI library: Tailwind CSS for quick layout (configured locally).
- Mock payment step with modal (future integration point).

## Payment Module Architecture

### Components
1. **PaymentStatementPage** (`frontend/src/pages/payments/PaymentStatementPage.tsx`)
   - Displays payment history and passbook for donors and admins
   - Shows pooja dues with recurring date logic (1st of each month)
   - Calculates running balance with opening balance from database
   - Provides multi-donor view for admins with phone number display
   - Supports filtering by donor, month, and payment status
   - Enables PDF and Excel exports

2. **PaymentPage** (`frontend/src/pages/payments/PaymentPage.tsx`)
   - Handles payment processing for individual donors
   - Displays cart items with amounts and dates
   - Provides UPI payment link generation
   - Shows bank account details for manual transfer
   - Records payment details (reference, date, amount)
   - Tracks payment history

3. **CombinePaymentPage** (`frontend/src/pages/payments/CombinePaymentPage.tsx`)
   - Manages combined/group account payments
   - Aggregates items from linked donor accounts
   - Makes unified payment for entire combined group
   - Displays all group members and their contributions
   - Access controlled via combine permissions

### Data Flow
```
Payment Records → Transform Dates → Apply Filters → Build Passbook Entries
    ↓                ↓                  ↓                    ↓
Fetch from API    Recurring Logic    Donor/Month/Status    Calculate Balance
              (1st of month)            Filters
```

### Date Logic for Recurring Poojas
- **Recurring Pooja**: Generates 12 months starting from current month, all on 1st of month
  - Example: Jan 2026 recurring → 01/01/2026, 01/02/2026, ..., 01/12/2026
- **One-time Registration**: Shows current date
  - Example: Today's date in passbook

### Balance Calculation
```
Closing Due = Opening Balance + Pooja Due - Payment Received
```
- Opens with opening balance (typically 31/12/2025)
- Each due entry increases closing due
- Each paid entry decreases closing due
- Running total carried through passbook


## Docker & Environment
- `docker-compose.yml` builds three services.
- `.env.example` holds shared environment variables.
- Backend container runs `python manage.py migrate` and `gunicorn` in entry script.
- Frontend container uses Vite dev server (prod build served via nginx in future iteration).

## Key Assumptions
- OTP delivery is mocked via API response/log (no SMS integration yet).
- Payment gateway not implemented; record creation only.
- Admin seeded via Django management command.

## Next Steps After Scaffold
- Replace mock OTP/payment logic with real integrations.
- Harden security (HTTPS, CORS, CSRF tokens for session auth if needed).
- Add automated tests (pytest + React testing library) once core flows are stable.
