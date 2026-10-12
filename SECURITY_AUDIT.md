# Security Audit — Writathon Lead Management System

Audit date: 2026-10-12. Method: full read of the backend and the affected frontend pages, then negative tests
against a throwaway database (`backend/test_workflow.py`) and the local dev server. Nothing was tested against production.

"Confirmed" = shown by a test or by reading the code path end to end. "Potential" = a risk that depends on
deployment or that wasn't exploitable in the tested setup.

## Confirmed findings (all fixed)

| ID | Severity | Finding | Area | Fix | Verified by |
|---|---|---|---|---|---|
| C1 | **Critical** | The public tracking-ID lookups (`/leads/by-code`, `/leads/by-token`) returned the full staff record: parent phone, internal reviewer notes, plagiarism notes, full email bodies, the private access token, payment link and story file URL. Anyone with or guessing an ID saw a child's full file. | `api/leads.py` | Separate parent view (`PublicLeadDetailOut`): masked email, no phone, notes, email bodies, file link or token; payment token only while payment is due; rate-limited. | TW "R27 …" (4 checks), UI screenshot |
| H1 | High | Story files (children's unpublished work) were downloadable **without login** by anyone with the URL; the URL was in the public lookup (C1). | `api/submissions.py` | Staff/admin only; only files linked to a submission; `attachment`, `nosniff`, `no-store`. Frontend fetches with the staff token. | TW "Sec10 …" (2), "R22 path traversal …", UI (HTTP 200 with token) |
| H2 | High | A duplicate registration (same parent email + child name) returned the existing record, including tracking ID and access token, to whoever submitted the form. That gave full access and the ability to replace the child's story. | `api/leads.py` | 409 with no record data; the ID is re-sent to the email on file (throttled to once per 15 min). | TW "R17 duplicate registration -> 409", "R21 duplicate response does not leak tracking ID" |
| H3 | High | Any staff user could set any lead to `PAID`, `COMPLETED`, `ELIGIBLE`… through bulk update, with no record of who did it. | `api/leads.py` | Only `NEW`/`CONTACTED`/`REMINDER_SENT` by hand, only from those statuses; per-lead audit. | TW "R12/Sec8 …", "R15 …" |
| H4 | High | Workflow integrity: a story could be marked `PUBLISHED` without payment; reviews and plagiarism results could be changed after payment; a reversed decision left the payment link usable. | `api/publications.py`, `api/reviews.py`, `api/plagiarism.py` | Publication requires payment; review and plagiarism lock after payment; reversal expires open links; plagiarism `PASS` required for `ELIGIBLE`. | TW "Sec11 publish before payment -> 409", "R23 … locked after payment", "R25 reversing …" |
| H5 | High | Emails were never sent but were logged as `SENT`. Parents never got tracking IDs or payment links, and staff were told they had. | `services/email_service.py` | SMTP delivery; real outcome stored (`SENT`/`FAILED`/`PENDING`). | TW "R24 …" (fake SMTP) |
| M1 | Medium | No rate limiting on login, registration, tracking-ID lookup or upload (password guessing, ID enumeration, spam). | `api/auth.py` etc. | Per-IP, per-route limit (`RATE_LIMIT_PER_MINUTE`, default 20/min). | TW "Sec9 repeated logins throttled (429)" |
| M2 | Medium | A story could be replaced after review/eligibility, invalidating the review it was approved under. | `api/submissions.py` | Replacement only before review starts. | TW "R4 replace blocked once review started" |
| M3 | Medium | The unauthenticated form overwrote a known student's phone/school (data tampering). | `api/leads.py` | Existing student details are not changed by the public form. | TW "Sec public form cannot overwrite …" |
| M4 | Medium | `publication_url` accepted any string and the parent page renders it as a link, so `javascript:` URLs were possible. | `schemas` | Must match `https?://…`. | TW "Sec publication URL must be http(s)" |
| M5 | Medium | CORS `*` with credentials allowed. | `main.py` | Origins from `CORS_ORIGINS`; credentials off (bearer tokens). | curl: foreign-origin preflight → 400 |
| M6 | Medium | Any staff user could set an arbitrary fee on a payment link. | `api/payments.py` | Fee override admin-only, must be > 0, audited. | TW "Sec11 staff cannot override the fee" |
| M7 | Medium | No DB constraints for concurrent duplicate registrations/students; duplicate webhooks re-ran the paid transition and emails. | models, `payment_service.py` | Unique indexes; atomic `PAID` claim; currency checked. | TW "R30 …", "R25/R30 duplicate webhook …", "Sec11 wrong currency -> 400" |
| L1 | Low | JWT lifetime 7 days. | `core/config.py` | 12 hours (deactivated users are still rejected immediately). | Code |
| L2 | Low | DOCX check accepted any Office zip (xlsx/pptx); whole upload read into memory before the size check. | `storage_service.py` | Requires `word/document.xml`; reads at most limit + 1 bytes. | TW "R22 xlsx renamed .docx rejected", "R22 oversized …" |
| L3 | Low | Unbounded `limit` on the communications list; negative `skip` accepted. | `api/emails.py` etc. | Bounded. | curl: `limit=100000` → 422 |
| L4 | Low | Silent `except: pass` hid failures. | several | Logged with stack traces. | Code |
| L5 | Low | Staff download link hard-coded to `http://localhost:8000` (broken outside local dev). | `LeadDetailPage.tsx` | Uses the configured API client. | UI |

## Security negative tests (from the brief)

| # | Scenario | Result |
|---|---|---|
| 1 | Protected operations without authentication | 401 on leads, lead detail, students, submissions, stats, users, audit, communications, file download |
| 2 | Another student's registration | Only via that registration's tracking ID; returns the limited view; staff APIs need staff role |
| 3 | Another student's story | Files are staff-only (401 anonymous, 403 parent) |
| 4 | Manipulating registration identifiers | Unknown/altered IDs → 404 with the same message; IDs are random (~40 bits) and lookups rate-limited |
| 5 | Unauthorized admin actions | Staff → 403 on Writathon create, user create/role change, audit log; admin can't change own role |
| 6 | Duplicate registrations | 409 (app check + DB unique index) |
| 7 | Invalid / oversized files | 400 for text, renamed xlsx, empty, oversized |
| 8 | Unauthorized status transitions | 400 for workflow statuses by hand; per-lead skip for leads past the manual stage |
| 9 | Repeated requests | 429 after the per-minute limit |
| 10 | Private documents without permission | 401/403; traversal and unlinked files → 404 |
| 11 | Manipulating eligibility/payment | Frontend checkout 403 outside demo; unsigned webhook 401; wrong amount/currency 400; decision locked after payment |
| 12 | Unexpected fields | Ignored (`status`, `owner_id`, `reminder_count` in the registration body had no effect) |
| 13 | Unauthorized bulk operations | Parent → 403 |
| 14 | Another Writathon's data | Staff see all Writathons by design; the public view only shows the one registration the ID belongs to |

## Remaining vulnerabilities and risks

| Severity | Item | Why it remains |
|---|---|---|
| Medium | All `STAFF` users can read every child's and parent's details and export them to CSV. | Needs a decision on roles (reviewer vs. manager). |
| Medium | No malware scanning of uploads (files are only downloaded by staff). | No scanner available here; consider ClamAV or a storage-provider scan. |
| Medium | Rate limiting is in-memory and per process: it resets on restart and isn't shared between workers. | Fine for one process; move to Redis or the reverse proxy for scale (`shortcut:` comment in `core/rate_limit.py`). |
| Medium | Payment gateway integration is generic (HMAC webhook), not a real Razorpay/Stripe integration. | Needs the chosen provider's event format and keys. |
| Low | Staff JWT stored in `localStorage` (readable by any XSS). React escapes output, email values are HTML-escaped, and no XSS was found, but an httpOnly cookie would be safer. | Larger change to auth flow. |
| Low | No account lockout or MFA for staff; only the IP rate limit. | — |
| Low | `GET /writathons` lists `DRAFT` events publicly. | Names/dates only. |
| Low | Tracking-ID holder can make the first submission for that registration. | Intended design: the ID is the parent's key. |
| Low | Python dependencies use `>=` ranges; no dependency vulnerability scan was run. | Pin versions and run `pip-audit` / `npm audit` in CI. |

## Not verified
- Production configuration: real `SECRET_KEY` strength, HTTPS, security headers on the Netlify frontend, `DEMO_MODE=false` in production.
- PostgreSQL behaviour (row locks, expression index); only SQLite was tested.
- Real SMTP delivery and a real payment gateway.
- Behaviour under real concurrent load.
