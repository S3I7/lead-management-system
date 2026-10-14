# Writathon Lead Management System (CRM)

A dedicated, real-world CRM and Editorial Workflow platform purpose-built for managing the complete journey of children and parents participating in a Writathon.

---

## 🚀 The 11-Step Lead Journey Workflow

```
PARENT                                                STAFF / ADMIN
  │                                                         │
  ▼                                                         │
Interest Form Registration                                  │
  │                                                         │
  ▼                                                         │
Lead Created (e.g. WR-2026-K7QX9M2P, Status: NEW)           │
  │                                                         │
  ▼                                                         │
Confirmation Email Dispatched (Status: CONTACTED)           │
  │                                                         │
  ▼                                                         │
Configurable Reminder Emails (Day 3, 7, 14; REMINDER_SENT)  │
  │                                                         │
  ▼ (Story Submitted)                                       │
Story Submitted (DOCX / PDF magic byte validation)          │
  │                                                         │
  ├─────────────────────────────────────────────────────────┤
  │ Reminders automatically stopped upon submission         │
  │ Submission Confirmation Email sent                      │
  ▼                                                         │
Under Review Queue ─────────────────────────────────────────► Staff opens story
                                                            │
                                                            ▼
                                                Manual Plagiarism Check
                                                (STRICTLY HUMAN REVIEWER, NO AI)
                                                PASS / FLAGGED / NOT_CHECKED
                                                            │
                                                            ▼
                                                    Staff Review Decision
                                                ┌───────────┴───────────┐
                                                ▼                       ▼
                                            ELIGIBLE              NOT_ELIGIBLE
                                                │                       │
                                                ▼                       ▼
                                        Payment Link & Email    Constructive Feedback
                                                │               Email Dispatched
                                                ▼
                                        Parent Opens Checkout
                                                │
                                                ▼
                                    Payment Gateway Simulation (UPI/Card)
                                                │
                                                ▼
                                    Server-Side Webhook Verification
                                    (Lead: COMPLETED, Story: APPROVED,
                                     Publication: READY, Payment: PAID)
                                                │
                                                ▼
                                    Payment & Final Confirmation Emails
                                                │
                                                ▼
                                    Publication Pipeline
                                    (Anthology URL, ISBN Notes -> PUBLISHED)
```

---

## 🔒 Security & Access Control (Parents vs Staff)

### 1. Backend Permission Enforcement
- **Staff / Admin Endpoints**: All protected CRM endpoints (`/api/v1/dashboard/stats`, `/api/v1/leads`, `/api/v1/reviews/*`, `/api/v1/plagiarism/*`, `/api/v1/publications/*`, `/api/v1/scheduler/*`, `/api/v1/emails/*`) require a valid JWT with role `STAFF` or `ADMIN`.
- **Parent Restrictions**: If a user logged in as `PARENT` attempts to request staff stats or leads data, the backend strictly returns **`403 Forbidden`** (`Operation requires Staff or Admin privileges`).
- **Parent Access**: Parents reach **their own** record with their tracking ID (random, e.g. `WR-2026-K7QX9M2P`, so it can't be guessed) through `/api/v1/leads/by-code/{lead_id}` or `/api/v1/leads/by-token/{token}`.
- **Payments**: Only a signed gateway webhook (`X-Webhook-Signature` = HMAC-SHA256 of the body with `PAYMENT_WEBHOOK_SECRET`) can mark a payment PAID. The mock checkout works only with `DEMO_MODE=true`.
- **Roles**: Admins manage Writathons, email templates and the team (`/admin/team`); staff manage leads, ownership, reviews and publications.

### 2. Frontend Route Protection
- **`ProtectedRoute` wrapper**: Wraps `/admin/dashboard`, `/admin/leads`, `/admin/leads/:id`, `/admin/templates`, and `/admin/communications`.
- If a parent visits `/admin/dashboard`, they are met with a dedicated **"Staff Access Only - Access Restricted"** screen directing them to the **Parent Portal**.
- **Adaptive Navbar**: The "Staff Dashboard" button is hidden for parents and replaced with a disabled badge.

---

## 💻 Tech Stack

### Frontend
- **React 18** with **TypeScript** and **Vite**
- **Tailwind CSS** implementing the exact custom design tokens:
  - Heading font: **DM Sans**, Body font: **Inter**
  - Primary Purple: `#6B46C1`, `#8B6FD4`, `#F3EEFF`
  - Secondary Coral/Pink: `#E8577D`, `#F1849C`, `#FFF0F3`
  - Rust: `#C2410C`, Indigo: `#534AB7`, Gold: `#FFD700`
  - Pill buttons (`border-radius: 50px`), rounded cards (`border-radius: 20px`), glassmorphism
- **React Router v6**
- **TanStack Query** & **Axios**
- **Lucide React Icons**

### Backend
- **Python 3.14** with **FastAPI**
- **SQLAlchemy** with SQLite (`sqlite:///./writathon.db`) or PostgreSQL support
- **Alembic** migrations
- **Pydantic v2** validation schemas
- **JWT Authentication** (`python-jose`, PBKDF2-HMAC-SHA256 salted hashing)
- **Local / S3-compatible Object Storage** with genuine DOCX and PDF magic byte inspection
- **Background Worker**: Periodic reminder task runner & on-demand trigger endpoint (`/api/v1/scheduler/run-reminders`)
- **Automated Email Template Engine**: 8 templates with variable interpolation and delivery logging

---

## 🏃 Running the Application

### 1. Start the Backend API
Copy `backend/.env.example` to `backend/.env` and set `SECRET_KEY` (required). For production also set `ADMIN_EMAIL` / `ADMIN_PASSWORD` (first admin) and `PAYMENT_WEBHOOK_SECRET`. Set `DEMO_MODE=true` only locally, to get the demo users, sample leads and mock checkout.

The schema is created on startup. If you have a `writathon.db` from before the Students / lead-owner change, delete it once so it is recreated.
```powershell
cd c:\Users\arrsa\lms\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Base: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 2. Start the Frontend
```powershell
cd c:\Users\arrsa\lms\frontend
npm run dev -- --port 5173 --host
```
- Web Application: `http://localhost:5173`

---

## 👥 Staff & Admin Credentials (`DEMO_MODE=true` only)

Log in with:
| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@writathon.com` | `admin123` | Full access to CRM, Writathons, Templates, Users |
| **Staff Reviewer** | `reviewer@writathon.com` | `staff123` | Leads management, Plagiarism assessment, Editorial decision |

> **Note for Parents**: Parents do not need an account or login. All registration, story submission, review tracking, and payments are done friction-free using their unique Tracking ID (`WR-YYYY-XXXXXXXX`) or email token link.

---

## 🔗 Key Application Routes

- **Public Interest Form**: [http://localhost:5173/register](http://localhost:5173/register)
- **Story Submission Portal**: [http://localhost:5173/submit-story](http://localhost:5173/submit-story)
- **Parent Status Tracker**: [http://localhost:5173/status](http://localhost:5173/status)
- **Staff Dashboard**: [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard)
- **Leads Directory**: [http://localhost:5173/admin/leads](http://localhost:5173/admin/leads)
- **Lead Detail View**: [http://localhost:5173/admin/leads/5](http://localhost:5173/admin/leads/5)
- **Email Templates Manager**: [http://localhost:5173/admin/templates](http://localhost:5173/admin/templates)
- **Communications Audit Log**: [http://localhost:5173/admin/communications](http://localhost:5173/admin/communications)
- **Story Submissions**: [http://localhost:5173/admin/submissions](http://localhost:5173/admin/submissions)
- **Students & Participation History**: [http://localhost:5173/admin/students](http://localhost:5173/admin/students)
- **Writathon Events**: [http://localhost:5173/admin/writathons](http://localhost:5173/admin/writathons)
- **Team & Access (admin)**: [http://localhost:5173/admin/team](http://localhost:5173/admin/team)

Backend self-check (no server needed): `cd backend && python test_security.py`
