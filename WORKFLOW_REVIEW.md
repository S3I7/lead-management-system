# Workflow Review

How the student, parent and staff workflows run after the 2026-10-12 fixes, which transitions are allowed, and
what is still incomplete. API paths are under `/api/v1`.

## 1. Writathon creation (admin)
`POST /writathons` with name, unique code, dates, guidelines, fee and currency. Dates must satisfy
`start ≤ submission deadline ≤ end`. Lifecycle via `PUT /writathons/{id}` `status`:

| Status | Meaning | Registration | Submission | Reminders |
|---|---|---|---|---|
| DRAFT | Not published | closed | closed | no |
| ACTIVE | Published | open until the submission deadline | open until the deadline | yes, until the deadline |
| SUBMISSIONS_CLOSED | Closed | closed | closed | no |
| COMPLETED | Archived (history kept) | closed | closed | no |

Every create/update is audited with before/after values.

## 2. Registration and tracking ID (parent, public)
1. Parent fills in the interest form (`POST /leads/register`). It's validated, and terms must be accepted.
2. The system finds the student (parent email + child name), or creates one.
3. If this student is **already registered** for this Writathon → **409**, and the confirmation (with the tracking ID)
   is re-sent to the email on file, at most once per 15 minutes. This is also the "forgot my tracking ID" path.
4. Otherwise a registration (lead) is created with a random tracking ID `WR-YYYY-XXXXXXXX` and a private link
   token, status `NEW`. Lead, student and audit row (including terms acceptance) commit together.
5. The confirmation email is sent. Status becomes `CONTACTED` **only if delivery succeeded**. A failure is recorded
   on the communication log and does not undo the registration.
6. The registration screen shows the tracking ID and a button to submit a story straight away.

## 3. Returning participants
- **Same Writathon:** use the tracking ID (status page or submit page) or the private link in the email.
- **New Writathon:** register again. The same student record is reused, a new registration is created, and earlier
  registrations stay untouched (history in Staff → Students).
- **Can't find the registration:** the submit page links to the interest form. Registering again either creates the
  registration or (if it exists) re-sends the ID to the original email.

## 4. Story submission (parent, public)
`POST /submissions` with the tracking ID or private token, title, originality declaration and a PDF/DOCX file (≤ 25 MB, checked by content).
- Allowed while the Writathon is `ACTIVE` and before the submission deadline.
- One story per registration. It may be **replaced only until a reviewer starts** (story `SUBMITTED`, plagiarism
  not checked, no decision); after that → 409 "contact the team".
- Effects: story `SUBMITTED`, lead `STORY_SUBMITTED` (reminders stop), plagiarism record `NOT_CHECKED`, audit row,
  confirmation email.

## 5. Manual review (staff)
1. **Plagiarism check** (`POST /plagiarism/{story}`): human reviewer records `PASS` or `FLAGGED` with notes and
   sources. First check moves story → `UNDER_REVIEW`, lead → `UNDER_REVIEW`. No AI is involved.
2. **Eligibility decision** (`POST /reviews/{story}`):
   - requires a recorded plagiarism check; `ELIGIBLE` requires `PASS`; `NOT_ELIGIBLE` requires feedback (sent to the parent);
   - `internal_notes` are never shown to parents;
   - saving the same decision again only updates text (no new email or payment link);
   - changing `ELIGIBLE → NOT_ELIGIBLE` expires any unpaid payment link;
   - both steps are **locked once payment completes**;
   - every check and decision is audited with the previous value and previous reviewer.

## 6. Eligibility → payment → publication
1. `ELIGIBLE` → payment link created (7-day expiry), lead `PAYMENT_PENDING`, payment email sent.
2. Payment is confirmed **only** by the signed gateway webhook (`POST /payments/webhook`, HMAC-SHA256 with
   `PAYMENT_WEBHOOK_SECRET`; amount and currency must match). The browser checkout endpoint works only in `DEMO_MODE`.
3. On success, in one transition: payment `PAID`, story `APPROVED`, lead `COMPLETED`, publication `READY`; payment
   and final confirmation emails. Duplicate webhooks are ignored. If the decision was reversed before the money
   arrived, the payment is recorded and flagged for a manual refund instead.
4. **Publication** (`PUT /publications/{story}`): allowed only after payment. `PUBLISHED` sets story `PUBLISHED`;
   the URL must be http(s) because it is shown to parents.

## 7. Lead status lifecycle

| Status | Set by | From |
|---|---|---|
| NEW | registration, or staff by hand | — / CONTACTED / REMINDER_SENT |
| CONTACTED | delivered confirmation email, or staff by hand | NEW / REMINDER_SENT |
| REMINDER_SENT | delivered reminder, or staff by hand | NEW / CONTACTED |
| STORY_SUBMITTED | story submission | NEW / CONTACTED / REMINDER_SENT / STORY_SUBMITTED |
| UNDER_REVIEW | first plagiarism check | STORY_SUBMITTED |
| ELIGIBLE → PAYMENT_PENDING | eligible decision (immediately followed by the payment link) | UNDER_REVIEW / NOT_ELIGIBLE |
| NOT_ELIGIBLE | not-eligible decision | UNDER_REVIEW / PAYMENT_PENDING |
| COMPLETED | verified payment | PAYMENT_PENDING |

Staff can set only `NEW`, `CONTACTED`, `REMINDER_SENT`, and only on leads still in one of them (`POST /leads/bulk-update`
reports skipped leads with the reason). `PAID` exists in the enum but nothing sets it: a paid lead becomes `COMPLETED`.

## 8. Email notifications

| Email | Trigger |
|---|---|
| Registration confirmation (tracking ID + private submit link) | registration; re-sent on duplicate registration |
| Submission reminder | days 3, 7, 14 after registration; only if no story, Writathon `ACTIVE`, before deadline |
| Submission confirmation | story submitted |
| Not-eligible feedback | `NOT_ELIGIBLE` decision |
| Payment link | `ELIGIBLE` decision; staff "send reminder" |
| Payment + final confirmation | verified payment |

Delivery uses SMTP (`SMTP_HOST` …). Outcome per email: `SENT`, `FAILED` (with error) or `PENDING` (SMTP not
configured). The reminder job runs hourly (and on demand from the dashboard). It does nothing while SMTP isn't
configured, and counts a reminder only when it was delivered, so failures are retried on the next run.

## Broken or incomplete transitions (remaining)
1. **No real payment gateway** — the webhook format is generic; wire the chosen provider before taking money.
2. **No real SMTP verified** — configure and send a test registration before launch.
3. **Refunds** after a reversed decision are manual (flagged in the audit log and server log).
4. **Expired payment links** — the demo checkout rejects them, but nothing re-issues them automatically; staff can
   send a new link (`POST /payments/send-reminder/{id}` re-sends the existing one; re-recording `ELIGIBLE` after
   `NOT_ELIGIBLE` issues a new one).
5. The reminder job runs inside the web process: if several workers run, each sends reminders.

## Backup & recovery
**Back up** (safe while the app runs): `cd backend && .venv/Scripts/python backup.py [target_dir]`.
This writes `backups/<timestamp>/writathon.db` and `uploads/`, then checks integrity and row counts.
`backend/backups/` is git-ignored because it holds personal data. Keep copies off the server and restrict access.

**Restore:**
1. Stop the app.
2. Keep the current `writathon.db` and `uploads/` aside, so the restore itself can be undone.
3. Copy `backups/<timestamp>/writathon.db` → `backend/writathon.db` and `backups/<timestamp>/uploads/` → `backend/uploads/`.
4. Start the app and check `/health`, a tracking-ID lookup and a staff login.

**Test a restore without touching live data:** copy a backup into a scratch folder and start the app with
`DATABASE_URL=sqlite:///<scratch>/writathon.db`. This was done on 2026-10-12: the app started and the restored data was readable.

Not yet in place: scheduled backups, encryption, off-site copies, PostgreSQL (`pg_dump`) procedure.
