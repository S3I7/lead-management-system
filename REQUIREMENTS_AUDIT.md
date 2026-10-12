# Requirements Audit — Writathon Lead Management System

Audit date: 2026-10-12. Scope: `backend/` (FastAPI + SQLAlchemy) and `frontend/` (React + Vite).
Statuses reflect the code **after** the fixes in `IMPLEMENTATION_SUMMARY.md`. "Evidence" names the check that
proves it: `TW` = `backend/test_workflow.py` (check name in quotes), `TS` = `backend/test_security.py`,
`TI` = `backend/test_integration.py` (live server), `UI` = browser check in headless Edge, `Code` = inspection only.

**Summary (30 items):** 16 PASS · 14 PARTIAL · 0 FAIL. Not verified anywhere: capacity under load (#20),
real SMTP delivery (#24), a real payment gateway (#25), PostgreSQL behaviour (#30).

| # | Requirement | Status |
|---|---|---|
| 1 | Multiple Writathon events | PASS |
| 2 | Lead registration & capture | PASS |
| 3 | Identify returning students | PASS |
| 4 | Story submission | PASS |
| 5 | New participant path | PASS |
| 6 | Correct data relationships | PASS |
| 7 | Central management dashboard | PARTIAL |
| 8 | Search & filtering | PARTIAL |
| 9 | Registered but not submitted | PASS |
| 10 | Submitted stories | PASS |
| 11 | Lead ownership | PARTIAL |
| 12 | Lead lifecycle | PASS |
| 13 | Participation history | PASS |
| 14 | Separate management views | PASS |
| 15 | Bulk lead operations | PARTIAL |
| 16 | Reports & statistics | PARTIAL |
| 17 | Duplicate lead prevention | PASS |
| 18 | Team access control | PARTIAL |
| 19 | Future Writathons without code changes | PASS |
| 20 | Scalability | PARTIAL (capacity NOT VERIFIED) |
| 21 | Registration tracking ID | PASS |
| 22 | Secure story documents | PARTIAL |
| 23 | Manual plagiarism & eligibility review | PASS |
| 24 | Email notifications & reminders | PARTIAL |
| 25 | Payment & publication workflow | PARTIAL |
| 26 | Audit history | PASS |
| 27 | Privacy & data protection | PARTIAL |
| 28 | Backup & recovery | PARTIAL |
| 29 | Error handling & monitoring | PARTIAL |
| 30 | Safe concurrent operations | PARTIAL |

---

## Original requirements

### 1. Multiple Writathon events — PASS
- **Expected:** create, edit, publish, close, archive; unique identity; separate settings; deadlines enforced; history kept.
- **Implementation:** `Writathon` model (unique `code`), `api/writathons.py` (admin-only create/update). Lifecycle is
  the `status` field: `DRAFT` → `ACTIVE` (published) → `SUBMISSIONS_CLOSED` (closed) → `COMPLETED` (archived).
  There is no delete endpoint, so history is never removed through the app.
- **Problems found:** dates were not validated (deadline could be after end date); registration stayed open after
  the submission deadline; no record of who changed an event.
- **Fixes:** date-order validation on create and update; registration closes when the submission deadline passes;
  create/update are written to the audit log with before/after values.
- **Evidence:** TW "R1 staff cannot create a Writathon", "R1 inconsistent dates rejected", "R1 duplicate code rejected",
  "R1 editing dates out of order rejected", "R2/R1 registration after deadline -> 400", "R4 completed event refuses submissions"; TS (closing blocks new stories).
- **Remaining:** no separate *registration* deadline field (registration closes at the submission deadline);
  `GET /writathons` without `active_only` also lists `DRAFT` events publicly (low risk: names/dates only).

### 2. Lead registration and capture — PASS
- **Implementation:** `POST /leads/register` (`api/leads.py`), validated by `InterestFormSubmit` (pydantic: lengths, email format, fixed age groups/categories, terms required).
- **Problems found:** registration and its confirmation email were not one unit: the lead was marked `CONTACTED` even though no email was sent (see #24); duplicate path returned someone else's record (see #21).
- **Fixes:** lead creation and its audit row commit together; a database unique index rejects concurrent duplicates (409 instead of a second row); the lead only becomes `CONTACTED` when the email was really delivered; unexpected fields (`status`, `owner_id`, …) are ignored.
- **Evidence:** TW "R2 missing required field -> 422", "R2 invalid email -> 422", "R2 terms not accepted -> 400", "R2 registration 201", "Sec12 unexpected fields ignored", "R24 SMTP failure recorded as FAILED; registration still saved".

### 3. Identify returning students — PASS
- **Implementation:** a `Student` is identified by normalised parent email + case-insensitive child name (`get_or_create_student`). Returning students submitting a story use their tracking ID (or the private link from their email).
- **Problems found:** the unauthenticated form overwrote an existing student's phone/school with whatever was typed.
- **Fixes:** an existing student's details are no longer changed by the public form (each registration keeps its own copy); uniqueness enforced by a DB index.
- **Evidence:** TW "R3/R6 returning student: new Writathon -> same student, new registration", "Sec public form cannot overwrite a known student's phone", "R17 shared parent email does not merge siblings".
- **Limitation:** a misspelt child name creates a new student (the safe direction — never a wrong merge). There is no staff "merge students" tool.

### 4. Story submission — PASS
- **Implementation:** `POST /submissions` (multipart) with tracking ID or private token; one story per registration (unique `story_submissions.lead_id`).
- **Problems found:** a story could be replaced after review/eligibility (resetting the review); a failed DB write left an orphan file; full upload buffered before the size check; weak DOCX detection.
- **Fixes:** replacement only while the story is still `SUBMITTED` and unreviewed (409 afterwards); uploaded file removed if the DB write fails; replaced file deleted; size limit applied while reading; DOCX must contain `word/document.xml`; title/word-count validated.
- **Evidence:** TW "R4 submission 201", "R4 replace allowed before review starts", "R4 replace blocked once review started", "R4 unknown tracking ID cannot submit", "R4 completed event refuses submissions", R22 checks; TI step 4.

### 5. New participant registration — PASS
- **Implementation:** registration checks for an existing student and registration first; a failed tracking-ID lookup on the submit page links to the registration form (`StorySubmissionPage.tsx`).
- **Evidence:** TW "R17 duplicate registration -> 409", "R3/R6 …"; Code (link to `/register` on the submit page — not clicked in the browser).

### 6. Correct data relationships — PASS
- **Implementation:** `Student 1—n Lead (registration) n—1 Writathon`; `Lead 1—1 StorySubmission`; submission 1—1 plagiarism review, 1—1 decision, 1—n payments, 1—1 publication. See `DATABASE_REVIEW.md`.
- **Fixes:** unique indexes `uq_lead_writathon_student`, `uq_student_identity`; added to existing databases at startup.
- **Evidence:** TW "R30 DB rejects 2nd registration for same student+Writathon", "R30 DB rejects duplicate student identity", "R13 history across Writathons incl. completed event".

### 7. Centralized management dashboard — PARTIAL
- **Implementation:** `GET /dashboard/stats`, `DashboardPage.tsx`, `LeadsListPage.tsx`; staff-only.
- **Problems found:** the "Eligible" count was always ~0 (an eligible lead immediately moves to `PAYMENT_PENDING`); list pages silently cut off at 1,000 rows.
- **Fixes:** decision-based counts and other report metrics added to the API (see #16); leads page now says "Showing 1000 of N" when truncated (total from the new `X-Total-Count` header).
- **Remaining:** no paging controls in the UI; every staff user sees every lead (no per-owner scoping); new metrics are API-only (not yet on the dashboard UI).

### 8. Search and filtering — PARTIAL
- **API (PASS):** Writathon, owner (incl. unassigned), lead status, submitted yes/no, story status (covers eligibility), payment status, registration date range, submission date range, age group, category, free-text (ID/child/parent/email/school/city). Filters combine with AND; `X-Total-Count` gives the full match count for consistent paging; staff role required.
- **Evidence:** TW "R8 X-Total-Count …", "R8 registration date filter", "R8 submission date filter", "R9 …", "R10 …", "Sec leads list requires staff"; TS filter checks.
- **Gap:** the leads page UI exposes status, Writathon, owner, submitted, age, category and search, but not the new date and payment-status filters.

### 9. Registered but not submitted — PASS
- Uses the existence of a submission (`submitted=false`), not the lead status. Report: `registered_not_submitted`; per-Writathon `not_submitted`. Reminders use the same rule.
- **Evidence:** TW "R9 registered-not-submitted", "R16 report metrics", "R24 day-3 reminders sent to non-submitters only"; TS.

### 10. Submitted stories — PASS
- `submitted=true`, `GET /submissions` (per Writathon/status). Staff download files through an authenticated request.
- **Evidence:** TW "R10 submitted", "R10 staff can download the story"; UI: staff download returned HTTP 200 with the staff token.

### 11. Lead ownership — PARTIAL
- **Implementation:** `POST /leads/bulk-update` with `owner_id` (single or many leads), staff/admin only, owner must be an active staff/admin.
- **Fixes:** every ownership change is written to the audit log (old → new owner, who, when); per-lead result list.
- **Evidence:** TW "R11 inactive owner rejected", "R11/R26 assignment history recorded with user", "Sec13 bulk update needs staff".
- **Gap:** assignment history is visible only through the admin-only `GET /audit` API; no UI; any staff member may reassign any lead (no manager role).

### 12. Lead lifecycle management — PASS
- Valid statuses and transitions are documented in `WORKFLOW_REVIEW.md`. Staff may set only `NEW`, `CONTACTED`, `REMINDER_SENT` by hand, and only on leads still in those statuses; everything later is driven by submission, review and payment events so the lead status can't contradict those records.
- **Problem found (High):** any staff member could set any lead to `PAID`/`COMPLETED`/`ELIGIBLE` through bulk update, with no record.
- **Evidence:** TW "R12/Sec8 workflow status cannot be set by hand", "R15 bulk result lists updated and skipped", "R26 key actions audited".
- **Note:** the requested `REGISTERED`, `CONVERTED`, `CLOSED` statuses don't exist; the existing equivalents are `NEW`/`CONTACTED`, `COMPLETED` (paid). No status was added, to avoid changing business rules without confirmation.

### 13. Student participation history — PASS
- `GET /students/{id}` returns all registrations across Writathons, including completed ones. Registrations are never overwritten (one row per Writathon).
- **Evidence:** TW "R13 history across Writathons incl. completed event"; TS.

### 14. Separate management views — PASS
- Leads (`/admin/leads`), lead detail, Writathons, Students (history), Submissions, Team, Email templates, Communication log, Dashboard. A "registration" *is* a lead row in this design, so there is no separate registrations screen. All views use the same API rules.

### 15. Bulk lead operations — PARTIAL
- Bulk owner and manual-status updates with per-lead validation, audit, and a result listing skipped leads; CSV export of the selected or filtered leads.
- **Evidence:** TW "R15 bulk result lists updated and skipped", "R12/Sec8 …", "Sec13 …".
- **Gaps:** no bulk email campaigns inside the app (campaigns run from the CSV in an external tool); no stored marketing-consent/opt-out flag (needs a business decision, see `SECURITY_AUDIT.md` → Privacy); selection only covers loaded rows (≤ 1,000).

### 16. Reports and statistics — PARTIAL
- API now returns: total Writathons, registrations and submissions per Writathon, unique students, total leads, registered-not-submitted, submissions, awaiting review, eligible / not-eligible decisions, ownership distribution, conversion rate (registrations with a PAID payment ÷ all registrations), payment counts and revenue. Definitions are in `api/dashboard.py`.
- **Evidence:** TW "R16 report metrics", "R16 ownership distribution sums to total leads".
- **Gap:** the dashboard page still shows the older stage counts; the new metrics are not displayed yet.

### 17. Duplicate lead prevention — PASS
- Email lower-cased and trimmed; child name compared case-insensitively; existing registration checked first; DB unique indexes catch concurrent requests; siblings sharing a parent email stay separate.
- **Evidence:** TW "R17 duplicate registration -> 409", "R17 shared parent email does not merge siblings", "R30 …" (both DB checks); TS.

### 18. Team access control — PARTIAL
- Roles: `ADMIN`, `STAFF`, `PARENT`. All checks are in the backend (`require_staff_or_admin`, `require_admin`), deactivated users are rejected on every request, users can't change their own role.
- **Evidence:** TW "Sec1 staff endpoints require auth", "Sec1 bad token -> 401", "Sec5 staff cannot change roles", "Sec admin cannot change own role", "Sec10 file download as PARENT user -> 403", "R26 audit log is admin-only"; TS; TI step 11.
- **Gap:** no `REVIEWER`/`MANAGER` split — every staff member can see all children's and parents' details and record reviews. Introducing roles is a business decision; not changed.

### 19. Support future Writathons — PASS
- Name, code, dates, guidelines, fee and currency are data; templates are shared and editable by admins; no code is Writathon-specific.
- **Evidence:** TW creates three events through the API and runs the full workflow on them.

### 20. Scalability — PARTIAL (capacity NOT VERIFIED)
- **Good:** indexed foreign keys and status columns; filters run in SQL; report counts use grouped queries; the reminder job now narrows candidates in SQL instead of loading every lead; list endpoints have upper limits.
- **Limits:** SQLite by default; rate limiter is in-memory (one process); emails are sent inside the request; files are on local disk; the reminder loop runs inside the web process (duplicates if several workers run); UI lists cap at 1,000 rows.
- **Not verified:** no load test was run, so no capacity figure is claimed.

---

## Additional requirements

### 21. Registration tracking ID — PASS
- 8 random characters from a 32-letter alphabet (~40 bits, `secrets`), unique per lead, checked against existing IDs.
- **Problems found (Critical/High):** the public tracking-ID lookup returned the full staff record: parent phone, internal reviewer notes, plagiarism notes, full email bodies, the private access token, the payment link and the story file URL. A duplicate registration also handed the existing tracking ID and token to anyone who knew the parent's email and child's name.
- **Fixes:** the lookup returns a limited parent view (masked email, no phone, no notes, no email bodies, no file link, payment token only while payment is due); same "not found" message for any unknown ID; rate-limited. A duplicate registration returns 409 and re-sends the ID **to the email on file** (at most every 15 minutes) — this is also the "forgot my ID" path.
- **Evidence:** TW "R21 …" (5 checks), "R27 public view hides phone/token/ids", "R27 public view masks email", "R27 public view has no email bodies", "R27 internal reviewer notes never public"; UI: status page screenshot shows `p***@example.com`, no phone, no download link.
- **Accepted risk:** whoever holds the tracking ID can see the limited status view and make the first submission. That is the intended design (ID = parent's key).

### 22. Secure story document handling — PARTIAL
- PDF/DOCX detected by content (magic bytes; DOCX must contain `word/document.xml`), 25 MB limit applied while reading, empty files rejected, stored under random names outside any public folder, client filename reduced to a safe basename.
- **Problem found (High):** story files were downloadable by anyone with the URL — no login.
- **Fix:** downloads require staff/admin and only serve files that belong to a submission (`attachment`, `nosniff`, `no-store`).
- **Evidence:** TW "R22 non-PDF/DOCX rejected", "R22 xlsx renamed .docx rejected", "R22 empty file rejected", "R22 oversized file rejected", "R22 unsafe client filename reduced to basename", "R22 replaced file is deleted from storage", "Sec10 file download without login -> 401", "Sec10 … PARENT … 403", "R22 path traversal in download -> 404", "R22 file not linked to a submission -> 404".
- **Gap:** no malware scanning (would need e.g. ClamAV — not available in this environment); files are not encrypted at rest.

### 23. Manual plagiarism and eligibility review — PASS
- Human-only; no AI detection was added. A plagiarism check must be recorded before a decision; a `FLAGGED` story can't be `ELIGIBLE`; `NOT_ELIGIBLE` needs feedback; decisions and checks lock once payment completes; every check/decision (with previous value and previous reviewer) goes to the audit log.
- **Evidence:** TW "R23 …" (6 checks), "Sec parent cannot record plagiarism check"; TI steps 5–6.
- **Note:** the review row holds the latest decision; earlier decisions are kept in the audit log.

### 24. Email notifications and reminders — PARTIAL
- **Problem found (High):** no email was ever sent. The service wrote each email to the log as `SENT` without delivering it, so parents never received tracking IDs, reminders or payment links.
- **Fixes:** SMTP delivery (`smtplib`, settings `SMTP_*`); outcome recorded honestly (`SENT` / `FAILED` with error / `PENDING` when SMTP isn't configured); failures never roll back the registration or submission; resends really resend. Reminders: first one now on day 3 (it fired about 90 seconds after registration), a reminder only counts when delivered, none when SMTP isn't configured, none for submitted leads or closed/past-deadline events; repeating the same review decision no longer re-sends the payment email.
- **Evidence:** TW "R24 …" (8 checks, using a fake SMTP server); TI shows emails logged as `PENDING` without SMTP.
- **Not verified:** delivery through a real SMTP provider. Emails are sent inside the web request (slow SMTP slows the response).

### 25. Payment and publication workflow — PARTIAL
- Order enforced: submission → plagiarism check → decision → payment link (only when `ELIGIBLE`) → signed webhook verifies amount and currency → `PAID` → publication (only after payment). Frontend checkout only works in `DEMO_MODE`.
- **Fixes:** publication blocked before payment; review locked after payment; reversing a decision expires the open payment link; fee override admin-only; duplicate webhooks produce one `PAID` record and one confirmation; payment after a reversed decision is recorded and flagged for refund; payment status changes audited.
- **Evidence:** TW "R25 …" and "Sec11 …" (13 checks); TS; TI steps 7–8.
- **Gap:** no real gateway integration — the webhook is a generic HMAC-signed format (existing `shortcut:` comment in `api/payments.py`); refunds are manual.

### 26. Audit history — PASS
- New append-only `audit_logs` table (user, action, entity, before/after values, timestamp), written in the same transaction as the change. Covers lead creation (incl. terms acceptance), assignment and manual status changes, submissions and replacements, plagiarism checks, decisions, payment link creation/expiry/status, publication, Writathon create/update, user create/role/active changes, template edits, email resends. Read via admin-only `GET /api/v1/audit`; no endpoint edits or deletes rows. No passwords or tokens are recorded.
- **Evidence:** TW "R26 key actions audited", "R11/R26 assignment history recorded with user", "R26 audit log is admin-only".
- **Gaps:** no UI; automatic reminder status changes are in the communication log, not the audit log; a database administrator can still edit rows.

### 27. Privacy and data protection — PARTIAL
- Fixed: public view minimised; parent email masked; story files private; internal notes never public; error messages don't echo IDs; consent (terms) recorded with a timestamp.
- **Needs business/legal confirmation before production:** retention and deletion periods (there is no delete/anonymise function), parental-consent wording for children's data (e.g. India DPDP Act 2023), a marketing opt-out flag, whether all staff should see contact details, and CSV export limits.

### 28. Backup and recovery — PARTIAL
- New `backend/backup.py`: online SQLite backup + uploads copy, with integrity and row-count verification. A backup of the dev database was taken and restored into a scratch copy, and the app started on the restored copy (8 leads and 6 submissions present). Procedure in `WORKFLOW_REVIEW.md` → Backup & recovery.
- **Gaps:** not scheduled, not encrypted, no off-site copy; PostgreSQL needs `pg_dump`.

### 29. Error handling and monitoring — PARTIAL
- Logging configured; swallowed exceptions (`except: pass`) now log with a stack trace; email failures stored with their error; failed logins logged by user id (never passwords); FastAPI returns generic 500s without stack traces.
- **Gaps:** logs go to stdout only; no alerting or error tracker; no health check for the reminder job or SMTP.

### 30. Safe concurrent operations — PARTIAL
- DB unique indexes for registrations, students and one-story-per-registration (IntegrityError → 409); atomic `PAID` claim for payments; row locks for bulk updates (effective on PostgreSQL, a no-op on SQLite).
- **Evidence:** TW "R30 …" (2 DB checks), "R25/R30 duplicate webhook: one PAID payment, one confirmation".
- **Gaps:** two reviewers saving at the same moment → last write wins (both are audited); concurrency was tested via constraints and repeated calls, not with true parallel load.
