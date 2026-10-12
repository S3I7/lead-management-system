# Implementation Summary — 2026-10-12

Work stayed within the existing stack (FastAPI, SQLAlchemy, React/Vite). No new dependencies: email uses Python's
`smtplib`, and rate limiting and the audit log are small in-house modules.

## Problems fixed
**Security**
- Public tracking-ID lookup exposed the full record (C1).
- Story files downloadable without login (H1).
- Duplicate registration leaked the tracking ID and token (H2).
- Staff could set any status, including PAID (H3).
- Publication without payment, and reviews editable after payment (H4).
- Emails logged as sent but never delivered (H5).
- Plus M1–M7 and L1–L5 — see `SECURITY_AUDIT.md`.

**Business logic**
- First reminder fired about 90 seconds after registration instead of on day 3.
- The dashboard "Eligible" count was always about 0.
- Leads were marked CONTACTED without any email.
- A story could be replaced after review.
- Eligibility could be decided without a plagiarism check.
- Repeating a decision re-sent the payment email.
- A reversed decision left the payment link usable.
- "Send payment reminder" could email an expired link.
- The leads list silently stopped at 1,000 rows.

**History and data integrity:** audit log, unique indexes, atomic payment confirmation, orphan-file cleanup.

## Files changed
**Backend: new files**
- `app/core/audit.py` — `audit()` helper, writes in the caller's transaction.
- `app/core/rate_limit.py` — per-IP, per-route limit.
- `app/api/audit.py` — admin-only `GET /audit`.
- `backup.py` — verified SQLite + uploads backup.
- `test_workflow.py` — 91 checks.

**Backend: modified files**
- `app/models/entities.py` — `AuditLog` table; unique indexes on students and leads.
- `app/main.py` — CORS from settings; logging; `ensure_constraints()` adds unique indexes to existing DBs; audit router; reminder job errors logged.
- `app/core/config.py` — `CORS_ORIGINS`, `SMTP_*`, `RATE_LIMIT_PER_MINUTE`; token lifetime 12 h.
- `app/api/leads.py`:
  - duplicate → 409 plus re-send to the email on file;
  - deadline check; race-safe creation; CONTACTED only on delivery;
  - public view; manual-status rules and audit in bulk update;
  - new filters and `X-Total-Count`.
- `app/api/submissions.py` — replace-before-review rule; staff-only download; input validation; orphan-file cleanup; audit.
- `app/services/storage_service.py` — bounded read; stricter DOCX check; safe original filename; `delete_file`.
- `app/api/reviews.py`, `app/api/plagiarism.py` — workflow rules, locks after payment, audit, story → UNDER_REVIEW.
- `app/api/payments.py`, `app/services/payment_service.py`:
  - admin-only fee override;
  - expiry check in the demo checkout; currency check;
  - atomic PAID; refund flag; audit;
  - no reminder for expired links.
- `app/api/publications.py` — requires payment; audit.
- `app/api/writathons.py`, `app/api/users.py`, `app/api/emails.py` — date validation and audit; resend really sends; bounded limits.
- `app/api/auth.py` — rate limit; failed-login log (no passwords).
- `app/api/dashboard.py`, `app/api/scheduler.py` — report metrics; scheduler message.
- `app/api/students.py` — bounded `skip`.
- `app/services/email_service.py` — SMTP delivery, honest status.
- `app/services/reminder_scheduler.py` — correct day-3/7/14 schedule; SQL narrowing; counts only delivered reminders; idle without SMTP.
- `app/schemas/all_schemas.py` — public view schemas; validation (dates, fee ≥ 0, http(s) URL, text lengths); audit and report schemas.
- `.env.example` — new settings documented.
- `test_security.py`, `test_integration.py` — updated for the intended behaviour changes.

**Frontend**
- `api/client.ts` — `PublicLeadDetail` type; `downloadStory()` (authenticated download).
- `pages/public/ParentStatusPage.tsx`, `StorySubmissionPage.tsx` — use the limited public view; no file link; submit with the tracking ID or private token.
- `pages/staff/LeadDetailPage.tsx` — authenticated download (was a hard-coded `localhost:8000` link).
- `pages/staff/LeadsListPage.tsx` — bulk status limited to manual statuses; skipped-lead message; "Showing N of M".
- `components/Navbar.tsx` — mobile menu (earlier request).

**Repo:** `.gitignore` excludes `backend/backups/`; six audit documents added at the repo root.

## Database changes
- New table `audit_logs` (created automatically).
- New unique indexes `uq_student_identity` and `uq_lead_writathon_student`, added at startup with `IF NOT EXISTS`.
- Applied to the dev DB after a verified backup (`backend/backups/20261012-103607`); no rows changed or removed.
- No columns were added or dropped. See `DATABASE_REVIEW.md` for the migration plan.

## Behaviour changes users will notice
- Registering the same child twice for the same Writathon shows "already registered — we've re-sent the tracking ID to your email" instead of the tracking ID.
- The parent status page no longer shows the phone number, full email, email contents or a download link.
- Reviewers must record the plagiarism check before the eligibility decision.
- Once a story is paid, its review and plagiarism check can't be changed. Stories can only be published after payment.
- Bulk "Set status" only offers New / Contacted / Reminder Sent.
- Without SMTP settings, emails show as **PENDING** (not delivered) instead of SENT, and leads stay NEW.
- Staff sessions expire after 12 hours.

## Tests
See `TEST_REPORT.md`. All suites pass: `test_workflow.py` 91/91, `test_security.py`, `test_integration.py`; frontend typecheck passes.

## Required configuration / manual actions before production
1. **SMTP:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`; register a test child and confirm the email arrives.
2. **CORS:** set `CORS_ORIGINS` to the deployed frontend URL; set `VITE_API_BASE_URL` on the frontend.
3. **Secrets:** a long random `SECRET_KEY`; `PAYMENT_WEBHOOK_SECRET`; `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first admin; **`DEMO_MODE=false`**.
4. **Payment gateway:** adapt `POST /payments/webhook` to the chosen provider's signed event format (see the `shortcut:` comment) and test with the provider's sandbox.
5. **Database:** move to PostgreSQL and create a real Alembic baseline (`DATABASE_REVIEW.md`).
6. **Backups:** schedule `backup.py` (or `pg_dump`) with encrypted, off-site copies; test a restore periodically.
7. **Run one app process,** or move the rate limiter and reminder job out of the web process before scaling out.
8. **Business/legal decisions:** data retention and deletion, parental consent wording, marketing opt-out, and whether to split STAFF into reviewer/manager roles.

## Remaining limitations
- No real payment gateway; no real SMTP verified.
- No malware scanning.
- No paging UI; the new report metrics and filters are API-only.
- No staff UI for the audit log; all staff see all personal data; tokens kept in `localStorage`.
- No retention/deletion feature.
- Load capacity untested.

## Production readiness
**Not production-ready yet.** The security and workflow defects found are fixed and tested, but money and email,
the two outward-facing parts, aren't connected to real providers. The database still has no real migrations or
backup schedule, and the privacy decisions above are open. Items 1–6 above are the minimum before launch.
