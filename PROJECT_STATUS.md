# PROJECT STATUS

## 1. Project Direction

- Graduation project direction: `Phan mem doanh nghiep`
- Product framing:
  - Web-based music service management system
  - Includes user accounts, subscription plans, simulated billing, admin reporting, music playback, playlists, and recommendation features
- Suggested thesis framing:
  - `He thong quan ly va cung cap dich vu nghe nhac truc tuyen tren nen tang web`

## 2. Current Tech Stack

### Frontend
- React
- React Router
- Custom admin/reporting UI

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT auth

### Infra / Storage
- Docker Desktop
- Docker Compose
- PostgreSQL container
- MinIO container

### Recommendation / Music Data
- Local dataset CSV
- FAISS / recommender loader fallback
- Gemini-based emotion prompt flow

## 3. Core Features Already Present

### User-facing
- Sign up / sign in / refresh token
- Account settings
- Password change
- Music playback
- Search by track / album / artist
- Emotion-based music suggestion
- Playlists
- Liked songs
- Recent listening history

### Admin-facing
- Admin database CRUD page
- Status toggle for `songs`, `albums`, `artists`
- Dashboard overview
- Activity logs
- Top songs reports
- Top users reports
- Payments report
- Subscriptions report

## 4. Enterprise Features Added

### Plans / Subscription / Billing
- `Free` and `Premium` plans
- Default plan seeding
- Subscription table
- Payment table
- Billing page in Settings
- Free/Premium gating for features

### Simulated Payment Workflow
- Payment statuses:
  - `pending`
  - `paid`
  - `failed`
- Premium upgrade flow:
  - selecting Premium creates a `pending` payment
  - user confirms payment manually in Billing
  - Premium is activated only after confirmation
- Failure flow:
  - user can mark payment as failed
- Manual renewal:
  - Premium user can renew for 30 more days
- Auto-renew simulation:
  - if Premium expires and `auto_renew=true`, backend auto-extends the subscription and creates a paid payment
- Expiry warning:
  - Billing page warns when the subscription is close to expiry

### Admin Reporting
- Dashboard metrics:
  - total users
  - free users
  - premium users
  - active subscriptions
  - expiring subscriptions
  - total payments
  - pending payments
  - failed payments
  - total revenue
  - active/inactive songs
  - active/inactive albums
  - active/inactive artists
- Separate report pages:
  - `Top Songs`
  - `Top Users`
  - `Payments`
  - `Subscriptions`
- Time filters:
  - Top Songs: `all / week / month`
  - Top Users: `all / week / month`
- Payment status filters:
  - `all / pending / paid / failed`
- Subscription status filters:
  - `all / active / pending_payment / cancelled / expired`
- Mini charts in overview:
  - revenue snapshot
  - payments by status
  - monthly revenue history
- Mock notification handling:
  - admin-facing expiring-subscription alert cards
  - notification preview text for simulated email/internal reminder

## 5. Status Management Added

- `songs.is_active`
- `albums.is_active`
- `artists.is_active`

Behavior:
- inactive songs/albums/artists are filtered from major user-facing APIs
- admin can toggle quickly from the table view

## 6. Files / Areas Changed Recently

### Backend
- `backend/main.py`
- `backend/routes/music_routes.py`
- `backend/routes/user_routes.py`
- `backend/routes/table_routes.py`
- `backend/utils/billing.py`
- `backend/utils/activity.py`
- `backend/models/song.py`
- `backend/models/album.py`
- `backend/models/artist.py`
- `backend/models/payment.py`
- `backend/models/subscription.py`
- `backend/models/plan.py`
- `backend/models/activity_log.py`
- `backend/models/listening_history.py`
- `backend/schemas/billing.py`

### Frontend
- `frontend/src/pages/AdminCrud.jsx`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/components/MainContent/MainContent.jsx`
- `frontend/src/components/MainContent/SectionScroller.jsx`
- `frontend/src/styles/MainContent/AdminCrud.css`
- `frontend/src/styles/MainContent/Settings.css`

### Project / Infra
- `start-dev.ps1`
- `docker-compose.yml`
- `frontend/.env.development`
- `PROJECT_STATUS.md`

## 7. Important Runtime Notes

### Standard startup
From repo root:

```powershell
cd "C:\code\20252 da"
.\start-dev.ps1
```

If PowerShell blocks:

```powershell
cd "C:\code\20252 da"
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

### Manual startup fallback

Backend:

```powershell
cd "C:\code\20252 da"
docker compose up -d postgres minio
cd "C:\code\20252 da\backend"
& "C:\code\20252 da\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Frontend:

```powershell
cd "C:\code\20252 da\frontend"
npm start
```

### Docker / WSL recovery
If Docker breaks:

```powershell
wsl --shutdown
wsl --update
wsl --status
```

Then reopen Docker Desktop.

### Git lock issue
If git errors mention `index.lock`:

```powershell
Remove-Item "C:\code\20252 da\.git\index.lock" -Force
```

## 8. Known Limitations

- Billing is simulated, not connected to a real payment gateway
- Recommendation system is partially fallback-based in local environment
- Some old UI text may still have encoding artifacts
- Admin CRUD is functional but still somewhat generic visually
- No full automated test suite has been added yet
- Expiry alerts are mock/internal previews only, not real email delivery

## 9. Recommended Next Steps

### Best next engineering tasks
1. Add payment success-rate KPI
2. Add search / filter in admin reports
3. Add export CSV for payments / subscriptions reports
4. Add a persistent notification log table for expiry and payment events
5. Clean remaining text encoding issues in frontend labels/messages
6. Add basic test coverage for billing workflow
7. Add a real payment gateway only if thesis scope requires it

### Best next thesis/demo tasks
1. Prepare a clean demo flow:
   - normal user playback
   - billing upgrade request
   - confirm payment
   - expiring-soon warning / manual renewal
   - admin payments review
   - admin subscriptions review
   - top songs / top users / revenue dashboard
2. Update thesis wording to match enterprise software direction
3. Prepare screenshots for:
   - Billing page
   - Payments report
   - Top Songs report
   - Top Users report
   - Admin overview

## 10. How To Resume In A New Chat

In a new session, say:

- `Please read PROJECT_STATUS.md and continue from there`

Optional extra context:

- `We are continuing the enterprise-software graduation project`
- `Focus on backend/frontend code, not thesis writing`
- `Next task: ...`
