# Test Report — 2026-10-12

Environment: Windows 11, Python venv in `backend/.venv`, Node/Vite frontend, SQLite. Throwaway databases for the
automated suites. The dev server runs on the local `writathon.db`. No real student data, payment credentials or email
recipients were used: SMTP is a fake in-process server, and payments use a test HMAC secret.

## Baseline (before any change)

| Command (from `backend/`) | Result |
|---|---|
| `.venv/Scripts/python test_security.py` | **Passed** ("All security & lead checks passed.") |
| `.venv/Scripts/python test_integration.py` | **Could not run**: `ModuleNotFoundError: No module named 'requests'` (not in `requirements.txt`; the script also needs the live server with `DEMO_MODE=true`). |

## Final results

| Command | Result |
|---|---|
| `cd backend && .venv/Scripts/python test_workflow.py` (new) | **91/91 checks passed** |
| `cd backend && .venv/Scripts/python test_security.py` | **Passed** |
| `cd backend && PYTHONPATH=<dir with requests.py shim> .venv/Scripts/python test_integration.py` against the live dev server | **Passed** ("ALL 11 WORKFLOW STAGES … VERIFIED"). The shim is one line, `from httpx import get, post, put, patch, delete`, because `requests` isn't installed. This run adds one demo registration to the dev DB per execution. |
| `cd frontend && npx tsc -b` | **Passed** (no type errors) |
| `cd frontend && npx oxlint <changed files>` | No new warnings. The one warning I introduced (unused import) was removed. Older warnings (unused imports, hook dependencies) in those files remain. |
| `cd backend && .venv/Scripts/python backup.py` | **Passed**: backup written, `PRAGMA integrity_check` ok, row counts match |
| Restore test: backup copied to a scratch folder, app started with `DATABASE_URL` pointing at it (TestClient) | **Passed**: 8 leads, 6 submissions readable; tracking-ID lookup 200; unique indexes created on the restored copy |

## Changes to existing tests (intentional behaviour changes)
- `test_security.py`: a duplicate registration now expects **409 without the tracking ID** (it used to expect the
  existing record back, which was finding H2). Added a plagiarism `PASS` before the `ELIGIBLE` decision (new rule).
- `test_integration.py`: one `print` read `payment_link` from the public lookup, which no longer exposes it (finding C1). It now prints that the token was issued.

## What `test_workflow.py` covers
Each line of output is one check, named by requirement (R#) or security scenario (Sec#):

- **Writathons:** admin-only create, date validation, duplicate code, edit validation, deadline enforcement, completed events refuse submissions.
- **Registration:** required fields, email format, terms, past deadline, unexpected fields ignored, random tracking ID, PENDING email when SMTP is off.
- **Duplicates and identity:** duplicate → 409 without leaking the ID; re-send throttle; returning student across Writathons; public form can't overwrite contact data; siblings kept separate; DB constraints reject duplicates (both tables).
- **Tracking-ID privacy:** limited view, masked email, no email bodies, unknown ID → 404, internal notes never public.
- **Uploads:** wrong type, renamed xlsx, empty, oversized, unknown ID, unsafe filename, replace-before-review, old file deleted, replace blocked after review.
- **Downloads:** anonymous 401, parent 403, staff 200, traversal 404, unlinked file 404.
- **Filters:** submitted/not-submitted, total-count header, registration and submission date ranges, staff-only.
- **Review:** plagiarism required, FLAGGED ≠ ELIGIBLE, feedback required, reviewer recorded, no duplicate payment email, reversal expires link, fresh link on re-approval, locks after payment.
- **Payments:** publish-before-payment blocked, demo checkout off, fee override admin-only, unsigned/wrong-amount/wrong-currency webhooks rejected, PAID once on duplicate webhook.
- **Publication:** URL must be http(s); publish after payment.
- **Bulk:** workflow statuses rejected, per-lead skip reasons, inactive owner rejected, parent forbidden, assignment history audited with user.
- **Audit:** admin-only; key actions present.
- **Access:** staff can't change roles, admin can't change own role, bad token 401, 7 staff endpoints need auth.
- **History and reports:** history across Writathons; report metrics and ownership totals.
- **Email:** SMTP failure → FAILED with registration kept, delivered → CONTACTED, no reminder before day 3, day-3 reminders only to non-submitters, no repeat before the next interval.
- **Rate limit:** 4th login in a minute → 429.

## Manual / browser checks (headless Edge via DevTools protocol, local dev servers)
- Parent status page for a real tracking ID: renders; email shown as `p***@example.com`; no phone; no download link; email history shows subject and status only. No page exceptions.
- Staff lead detail: "Download" fetched the file with the staff token → HTTP 200.
- Leads list: bulk "Set status" offers only New / Contacted / Reminder Sent.
- Mobile navigation (earlier in the session): menu opens at 390 px and links work for public, staff and admin.
- CORS (curl): frontend origin allowed and `X-Total-Count` exposed; foreign-origin preflight → 400; `limit=100000` → 422.

## Not executed / gaps
- **Real SMTP provider** — not available; delivery tested with a fake SMTP class.
- **Real payment gateway** — not integrated; webhook tested with the generic signed format.
- **PostgreSQL** — not available; row locks (`SELECT … FOR UPDATE`) and the expression index were only exercised on SQLite.
- **True parallel requests** — concurrency checked via DB constraints and repeated calls, not simultaneous load.
- **Load/capacity testing** — not done; no capacity figure is claimed.
- **Malware scanning** — not implemented, so not tested.
- **Frontend unit tests** — the project has none; UI checked manually as above.
- **Safari / real phones** — not tested.
- `pip-audit` / `npm audit` — not run.
