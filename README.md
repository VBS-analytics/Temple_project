# Temple Donor Platform

Full-stack web application scaffold for managing temple donors, pooja registrations, and payments. The stack uses **React + Vite** for the UI, **Django REST Framework** for APIs, and **PostgreSQL** for storage—packaged together with Docker Compose.

## Features Implemented
- Donor onboarding with OTP flow, JWT-based login, and password resets (Forms 1–3).
- Admin and donor roles with tailored endpoints.
- Master data management for pooja options, day codes, and daily message templates (Forms 4–8).
- Donor dashboards, pooja registration (Form 10/11), daily calendar (Form 7–9), and payment logging (Form 13) screens in React.
- Payment tracking placeholders covering common offline modes, ready for later payment gateway integration.
- Docker Compose orchestration for Postgres, Django API, and React front-end.

## Prerequisites
- Docker and Docker Compose.
- Copy environment variables: `cp .env.example .env` (edit secrets as needed).

## Quick Start
```bash
# Build and launch
docker compose up --build

# Access services
# Frontend: http://localhost:5173
# Backend API docs (use Django admin or inspect endpoints via browser): http://localhost:8000/admin/
```

The backend entrypoint runs database migrations, collects static assets, and seeds an admin user (
`phone_number=9999999999`, `password=adminpass`). Update these credentials after the first login.

## Directory Layout
```
backend/   # Django project, REST API, custom apps (accounts, pooja, payments)
frontend/  # React + Vite SPA with React Router & tailwind
Dockerfile(s) & docker-compose.yml  # Container orchestration
```

### Backend Highlights
- Custom `User` model keyed on `phone_number`, with OTP management and donor profile data.
- Apps:
  - `accounts`: authentication, OTP requests, profile endpoints.
  - `pooja`: master data, donor message templates, registration CRUD.
  - `payments`: payment record tracking for offline/payment-gateway reconciliation.
- JWT authentication via `djangorestframework-simplejwt`.

### Frontend Highlights
- Zustand store persists auth tokens across refresh.
- React Router splits donor and admin flows with protected routes.
- Forms implemented with `react-hook-form`; API calls handled via Axios wrapper.
- Tailwind utility classes for lightweight styling.

## Next Steps
1. Integrate SMS provider for OTP delivery (replace mocked response).
2. Connect a real payment gateway and reconcile auto-debit reference numbers.
3. Add automated tests (pytest + React Testing Library) and CI pipeline.
4. Harden production pipeline (nginx for serving SPA/build, TLS termination, secrets management).

## Useful Commands
```bash
# Run Django management commands inside container
docker compose exec backend python manage.py shell

# Create additional admin user
docker compose exec backend python manage.py createsuperuser
```

## Assumptions
- OTPs are surfaced in API responses for development convenience.
- Payment workflows capture intent/history only; actual gateway integration is deferred.
- Email/SMS templates and translations can be layered on top of the existing models.
