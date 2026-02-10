# Temple Project – Agent Notes (updated Feb 9, 2026)

- **What this is**: Vite/React (TS) frontend + Django REST backend + Postgres, dockerized. Public site + donor workspace + admin console.
- **Primary domains**: Authentication (phone/OTP + JWT), Donor profiles/family, Pooja catalog & registrations (recurring + one-time), Astronomy-based scheduling, Payments & passbook (with combined-parent view), Exports (PDF/XLSX), Admin master-data tools.
- **Hot spots / recent fixes**:
  - Recurring pooja duplication bug (see `START_HERE.md`, `QUICK_REFERENCE.md`, `backend/pooja/services/recurrence.py`, `frontend/src/pages/DonorProfile.tsx`).
  - Combined payment statement access/filtering fix (Feb 8, 2026) in `backend/payments/views.py` and `frontend/src/pages/payments/PaymentStatementPage.tsx`.
- **Key docs to skim first**: `README.md` (overview + commands), `START_HERE.md` (recurrence bug), `PAYMENT_DOCUMENTATION.md` + `PAYMENT_MODULE_FLOW.md` (payments), `CHRT_*` series (calendar/recurrence), `DATABASE_DOCUMENTATION.md`.
- **Runbook snippets**:
  - Full stack: `docker compose up --build` from repo root.
  - Backend solo: `cd backend && python manage.py runserver 0.0.0.0:8000` (Postgres envs needed).
  - Frontend solo: `VITE_API_BASE_URL=http://localhost:8000/api npm run dev`.
- **Repo map (high level)**:
  - `backend/accounts/` auth & donor profiles; `backend/pooja/` master data, recurrence, scheduling; `backend/payments/` passbook/combined payments.
  - `frontend/src/pages/` public + donor + admin pages; `frontend/src/store/` Zustand stores; `frontend/src/lib/` axios client.
- **Things to remember**: Skyfield ephemeris cached under `backend/data/skyfield`; OTP/admin defaults seeded in `backend/entrypoint.sh`; storage keys in localStorage (`temple-auth-store`, `pooja-cart`, `pooja-registrations`).
