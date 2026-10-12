"""Workflow, data-integrity and security checks for the audit (REQUIREMENTS_AUDIT.md / TEST_REPORT.md).
Run: python test_workflow.py   (no server needed; uses a throwaway SQLite DB and a fake SMTP server)."""
import hashlib
import hmac
import json
import os
import tempfile

tmp = tempfile.mkdtemp()
os.environ.update({
    "SECRET_KEY": "test-secret",
    "DATABASE_URL": f"sqlite:///{tmp}/test.db",
    "DEMO_MODE": "false",
    "ADMIN_EMAIL": "admin@example.com",
    "ADMIN_PASSWORD": "admin-pass-123",
    "PAYMENT_WEBHOOK_SECRET": "whsec",
    "RATE_LIMIT_PER_MINUTE": "0",
    "SMTP_HOST": "",
})

from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.entities import Lead, Student, CommunicationLog, AuditLog, Payment
from app.services import email_service
from app.services.reminder_scheduler import ReminderSchedulerService

API = "/api/v1"
PDF = b"%PDF-1.4\n%%EOF"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))


class FakeSMTP:
    """Stands in for smtplib.SMTP: records messages, or fails when told to."""
    sent, fail = [], False

    def __init__(self, *a, **k):
        if FakeSMTP.fail:
            raise OSError("connection refused")

    def __enter__(self): return self
    def __exit__(self, *a): return False
    def starttls(self): pass
    def login(self, u, p): pass
    def send_message(self, msg): FakeSMTP.sent.append(msg)


email_service.smtplib.SMTP = FakeSMTP


def main():
    with TestClient(app) as c:
        def login(email, pw):
            r = c.post(f"{API}/auth/login", json={"email": email, "password": pw})
            return {"Authorization": "Bearer " + r.json()["access_token"]}

        admin = login("admin@example.com", "admin-pass-123")
        mk_user = lambda email, role: c.post(f"{API}/users", headers=admin, json={"email": email, "password": "pass-1234", "full_name": email.split("@")[0], "role": role}).json()
        staff_u = mk_user("staff@example.com", "STAFF")
        other_u = mk_user("other@example.com", "STAFF")
        mk_user("parent@example.com", "PARENT")
        staff = login("staff@example.com", "pass-1234")
        parent = login("parent@example.com", "pass-1234")
        now = datetime.now(timezone.utc)

        # ---- Req 1/19: multiple Writathons, data-driven, admin only, validated dates
        def make_w(code, deadline_days=30, status="ACTIVE"):
            r = c.post(f"{API}/writathons", headers=admin, json={
                "name": f"W {code}", "code": code, "start_date": (now - timedelta(days=1)).isoformat(),
                "end_date": (now + timedelta(days=90)).isoformat(),
                "submission_deadline": (now + timedelta(days=deadline_days)).isoformat(), "status": status})
            return r
        w1, w2 = make_w("A").json()["id"], make_w("B").json()["id"]
        check("R1 staff cannot create a Writathon", c.post(f"{API}/writathons", headers=staff, json={}).status_code == 403)
        bad = c.post(f"{API}/writathons", headers=admin, json={"name": "x", "code": "BAD", "start_date": now.isoformat(),
                                                               "end_date": (now - timedelta(days=5)).isoformat(), "submission_deadline": now.isoformat()})
        check("R1 inconsistent dates rejected", bad.status_code == 422, bad.text)
        check("R1 duplicate code rejected", make_w("A").status_code == 400)
        check("R1 editing dates out of order rejected", c.put(f"{API}/writathons/{w1}", headers=admin, json={"submission_deadline": (now + timedelta(days=200)).isoformat()}).status_code == 400)
        past = make_w("PAST", deadline_days=-1)
        check("R1 past-deadline event can be created (history)", past.status_code == 201, past.text)

        form = {"child_name": "Aarav Sharma", "age_group": "8-10", "submission_category": "Short Story", "city": "Chennai",
                "grade": "Grade 5", "school": "DPS", "parent_name": "Pooja", "parent_email": "Pooja@Example.com",
                "parent_phone": "+91 98765 43210", "country": "India", "terms_accepted": True}
        reg = lambda **kw: c.post(f"{API}/leads/register", json={**form, **kw})

        # ---- Req 2: validation
        check("R2 missing required field -> 422", c.post(f"{API}/leads/register", json={k: v for k, v in form.items() if k != "school"} | {"writathon_id": w1}).status_code == 422)
        check("R2 invalid email -> 422", reg(writathon_id=w1, parent_email="not-an-email").status_code == 422)
        check("R2 terms not accepted -> 400", reg(writathon_id=w1, terms_accepted=False).status_code == 400)
        check("R2/R1 registration after deadline -> 400", reg(writathon_id=past.json()["id"]).status_code == 400)
        r = reg(writathon_id=w1, status="PAID", owner_id=1, reminder_count=99)  # unexpected fields are ignored
        lead1 = r.json()
        check("R2 registration 201", r.status_code == 201, r.text)
        check("Sec12 unexpected fields ignored", lead1["status"] == "NEW" and lead1["owner_id"] is None and lead1["reminder_count"] == 0, lead1)
        check("R21 tracking ID is random WR-YYYY-XXXXXXXX", len(lead1["lead_id"].split("-")[2]) == 8)
        check("R24 lead stays NEW when email not delivered (no SMTP)", lead1["status"] == "NEW")
        with SessionLocal() as db:
            comm = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead1["id"]).one()
            check("R24 undelivered email recorded as PENDING, not SENT", comm.status.value == "PENDING" and "SMTP" in comm.error_message)

        # ---- Req 17/3/5: dedupe, returning students, siblings
        dup = reg(writathon_id=w1, parent_email="pooja@example.com", child_name="aarav sharma")
        check("R17 duplicate registration -> 409", dup.status_code == 409, dup.text)
        check("R21 duplicate response does not leak tracking ID", lead1["lead_id"] not in dup.text and "access_token" not in dup.text)
        with SessionLocal() as db:
            confs = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead1["id"]).count()
        check("R21 forgotten ID: duplicate within 15 min doesn't re-email (throttle)", confs == 1, confs)
        lead2 = reg(writathon_id=w2, parent_phone="+91 00000 00000").json()
        check("R3/R6 returning student: new Writathon -> same student, new registration", lead2["student_id"] == lead1["student_id"] and lead2["id"] != lead1["id"])
        with SessionLocal() as db:
            st = db.get(Student, lead1["student_id"])
            check("Sec public form cannot overwrite a known student's phone", st.parent_phone == "+91 98765 43210", st.parent_phone)
        sib = reg(writathon_id=w1, child_name="Diya Sharma").json()
        check("R17 shared parent email does not merge siblings", sib["student_id"] != lead1["student_id"])

        # ---- Req 30/17: DB constraints stop concurrent duplicates
        with SessionLocal() as db:
            dup_lead = Lead(**{k: getattr(db.get(Lead, lead1["id"]), k) for k in ("writathon_id", "student_id", "parent_name", "parent_email", "parent_phone", "child_name", "school", "grade", "country")},
                            lead_id="WR-X-DUP", access_token="dup-token")
            db.add(dup_lead)
            try:
                db.commit(); ok = False
            except IntegrityError:
                db.rollback(); ok = True
            check("R30 DB rejects 2nd registration for same student+Writathon", ok)
            db.add(Student(parent_email="pooja@example.com", child_name="AARAV SHARMA", parent_name="x", parent_phone="1", school="s", grade="g"))
            try:
                db.commit(); ok = False
            except IntegrityError:
                db.rollback(); ok = True
            check("R30 DB rejects duplicate student identity (case-insensitive name)", ok)

        # ---- Req 21/27: public tracking-ID view is limited
        pub = c.get(f"{API}/leads/by-code/{lead1['lead_id'].lower()}")
        body = pub.json()
        check("R21 status lookup by tracking ID works", pub.status_code == 200)
        check("R27 public view hides phone/token/ids", all(k not in body["lead"] for k in ("parent_phone", "access_token", "id", "student_id", "owner_id")), body["lead"].keys())
        check("R27 public view masks email", body["lead"]["parent_email"] == "p***@example.com", body["lead"]["parent_email"])
        check("R27 public view has no email bodies", all("body_content" not in m for m in body["communications"]))
        check("R21 unknown tracking ID -> 404", c.get(f"{API}/leads/by-code/WR-2026-ZZZZZZZZ").status_code == 404)

        # ---- Req 4/22: submissions and file validation
        sub = lambda token, content=PDF, name="s.pdf", title="My Story": c.post(f"{API}/submissions", data={"lead_token": token, "title": title, "originality_declaration": "true"}, files={"file": (name, content, "application/pdf")})
        check("R22 non-PDF/DOCX rejected", sub(lead1["lead_id"], b"hello world", "s.txt").status_code == 400)
        import io, zipfile
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("[Content_Types].xml", "<x/>"); z.writestr("xl/workbook.xml", "<x/>")
        check("R22 xlsx renamed .docx rejected", sub(lead1["lead_id"], buf.getvalue(), "s.docx").status_code == 400)
        check("R22 empty file rejected", sub(lead1["lead_id"], b"").status_code == 400)
        old_max = settings.MAX_FILE_SIZE_BYTES
        settings.MAX_FILE_SIZE_BYTES = 100
        check("R22 oversized file rejected", sub(lead1["lead_id"], PDF + b"x" * 200).status_code == 400)
        settings.MAX_FILE_SIZE_BYTES = old_max
        check("R4 unknown tracking ID cannot submit", sub("WR-2026-NOPENOPE").status_code == 404)
        r = sub(lead1["lead_id"], name="../../etc/evil.pdf")
        check("R4 submission 201", r.status_code == 201, r.text)
        story = r.json()
        check("R22 unsafe client filename reduced to basename", story["file_name"] == "evil.pdf", story["file_name"])
        first_file = story["file_url"].rsplit("/", 1)[1]
        r2 = sub(lead1["lead_id"], title="Revised")
        check("R4 replace allowed before review starts", r2.status_code == 201 and r2.json()["id"] == story["id"], r2.text)
        check("R22 replaced file is deleted from storage", not os.path.exists(os.path.join(settings.UPLOAD_DIR, first_file)))
        story = r2.json()
        fname = story["file_url"].rsplit("/", 1)[1]

        # ---- Sec10/R22: private downloads
        check("Sec10 file download without login -> 401", c.get(f"{API}/submissions/files/{fname}").status_code == 401)
        check("Sec10 file download as PARENT user -> 403", c.get(f"{API}/submissions/files/{fname}", headers=parent).status_code == 403)
        dl = c.get(f"{API}/submissions/files/{fname}", headers=staff)
        check("R10 staff can download the story", dl.status_code == 200 and dl.content == PDF)
        check("R22 path traversal in download -> 404", c.get(f"{API}/submissions/files/..%2F..%2Fapp%2Fmain.py", headers=staff).status_code == 404)
        check("R22 file not linked to a submission -> 404", c.get(f"{API}/submissions/files/{first_file}", headers=staff).status_code == 404)

        # ---- Req 9/10/8: submitted vs not, filters, pagination header
        ids = lambda q: {l["id"] for l in c.get(f"{API}/leads?{q}", headers=staff).json()}
        check("R9 registered-not-submitted", ids(f"submitted=false&writathon_id={w1}") == {sib["id"]})
        check("R10 submitted", ids("submitted=true") == {lead1["id"]})
        r = c.get(f"{API}/leads?limit=1", headers=staff)
        check("R8 X-Total-Count reflects all matches, not the page", r.headers.get("x-total-count") == "3" and len(r.json()) == 1, r.headers)
        today = now.date().isoformat()
        check("R8 registration date filter", ids(f"registered_from={today}") == {lead1["id"], lead2["id"], sib["id"]} and ids("registered_from=2999-01-01") == set())
        check("R8 submission date filter", ids(f"submitted_from={today}&submitted_to={today}") == {lead1["id"]})
        check("Sec leads list requires staff", c.get(f"{API}/leads").status_code == 401 and c.get(f"{API}/leads", headers=parent).status_code == 403)

        # ---- Req 23: manual review workflow
        sid = story["id"]
        check("R23 decision before plagiarism check -> 400", c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "ELIGIBLE"}).status_code == 400)
        check("Sec parent cannot record plagiarism check", c.post(f"{API}/plagiarism/{sid}", headers=parent, json={"status": "PASS"}).status_code == 403)
        c.post(f"{API}/plagiarism/{sid}", headers=staff, json={"status": "FLAGGED", "plagiarism_notes": "copied para"})
        check("R4 replace blocked once review started", sub(lead1["lead_id"]).status_code == 409)
        check("R23 FLAGGED story cannot be ELIGIBLE", c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "ELIGIBLE"}).status_code == 400)
        c.post(f"{API}/plagiarism/{sid}", headers=staff, json={"status": "PASS"})
        check("R23 NOT_ELIGIBLE requires feedback", c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "NOT_ELIGIBLE"}).status_code == 400)
        r = c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "ELIGIBLE", "feedback": "Lovely", "internal_notes": "SECRET-NOTE"})
        check("R23 ELIGIBLE decision recorded", r.status_code == 200 and r.json()["reviewer_id"] == staff_u["id"], r.text)
        pub = c.get(f"{API}/leads/by-code/{lead1['lead_id']}").json()
        check("R27 internal reviewer notes never public", "SECRET-NOTE" not in json.dumps(pub) and "copied para" not in json.dumps(pub))
        check("R25 payment link issued after ELIGIBLE", pub["payment"]["status"] == "LINK_SENT" and pub["lead"]["status"] == "PAYMENT_PENDING", pub["payment"])
        token1 = pub["payment"]["payment_link_token"]
        with SessionLocal() as db:
            n_links = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead1["id"], CommunicationLog.template == "PAYMENT_LINK").count()
        c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "ELIGIBLE", "feedback": "Lovely!"})
        with SessionLocal() as db:
            n_links2 = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead1["id"], CommunicationLog.template == "PAYMENT_LINK").count()
        check("R24 repeating the same decision sends no duplicate payment email", n_links2 == n_links, (n_links, n_links2))
        c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "NOT_ELIGIBLE", "feedback": "Needs work"})
        with SessionLocal() as db:
            p = db.query(Payment).filter(Payment.payment_link_token == token1).one()
            check("R25 reversing to NOT_ELIGIBLE expires the open payment link", p.status.value == "EXPIRED")
        c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "ELIGIBLE", "feedback": "Better now"})
        pay = c.get(f"{API}/leads/by-code/{lead1['lead_id']}").json()["payment"]
        check("R25 re-marking ELIGIBLE issues a fresh link", pay["status"] == "LINK_SENT" and pay["payment_link_token"] != token1)

        # ---- Req 25 / Sec11: payment verification
        check("Sec11 publish before payment -> 409", c.put(f"{API}/publications/{sid}", headers=staff, json={"publication_status": "PUBLISHED"}).status_code == 409)
        check("Sec11 frontend checkout disabled outside demo", c.post(f"{API}/payments/process-checkout/{pay['payment_link_token']}", json={}).status_code == 403)
        check("Sec11 staff cannot override the fee", c.post(f"{API}/payments/generate/{lead1['id']}", headers=staff, json={"amount": 1}).status_code == 403)

        def hook(amount, sign=True, currency=None):
            payload = {"event": "payment.captured", "payment_link_token": pay["payment_link_token"], "gateway_payment_id": "pay_1", "amount": amount, "status": "captured"}
            if currency:
                payload["currency"] = currency
            b = json.dumps(payload).encode()
            sig = hmac.new(b"whsec", b, hashlib.sha256).hexdigest() if sign else "bad"
            return c.post(f"{API}/payments/webhook", content=b, headers={"X-Webhook-Signature": sig, "Content-Type": "application/json"})
        check("Sec11 unsigned webhook -> 401", hook(pay["amount"], sign=False).status_code == 401)
        check("Sec11 wrong amount -> 400", hook(1.0).status_code == 400)
        check("Sec11 wrong currency -> 400", hook(pay["amount"], currency="USD").status_code == 400)
        check("R25 signed webhook marks PAID", hook(pay["amount"]).json()["payment_status"] == "PAID")
        hook(pay["amount"])  # duplicate delivery
        with SessionLocal() as db:
            n_conf = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead1["id"], CommunicationLog.template == "PAYMENT_CONFIRMATION").count()
            n_paid = db.query(Payment).filter(Payment.lead_id == lead1["id"], Payment.status == "PAID").count()
        check("R25/R30 duplicate webhook: one PAID payment, one confirmation", n_conf == 1 and n_paid == 1, (n_conf, n_paid))
        check("R23 review locked after payment", c.post(f"{API}/reviews/{sid}", headers=staff, json={"decision": "NOT_ELIGIBLE", "feedback": "x"}).status_code == 409)
        check("R23 plagiarism locked after payment", c.post(f"{API}/plagiarism/{sid}", headers=staff, json={"status": "FLAGGED"}).status_code == 409)
        check("Sec publication URL must be http(s)", c.put(f"{API}/publications/{sid}", headers=staff, json={"publication_status": "PUBLISHED", "publication_url": "javascript:alert(1)"}).status_code == 422)
        r = c.put(f"{API}/publications/{sid}", headers=staff, json={"publication_status": "PUBLISHED", "publication_url": "https://example.org/anthology"})
        check("R25 publish after payment", r.status_code == 200, r.text)

        # ---- Req 11/12/15: ownership, lifecycle, bulk
        r = c.post(f"{API}/leads/bulk-update", headers=staff, json={"lead_ids": [lead2["id"]], "status": "PAID"})
        check("R12/Sec8 workflow status cannot be set by hand", r.status_code == 400, r.text)
        check("Sec staff cannot assign owner", c.post(f"{API}/leads/bulk-update", headers=staff, json={"lead_ids": [lead2["id"]], "owner_id": other_u["id"]}).status_code == 403)
        r = c.post(f"{API}/leads/bulk-update", headers=admin, json={"lead_ids": [lead1["id"], lead2["id"], 99999], "status": "CONTACTED", "owner_id": other_u["id"]}).json()
        reasons = {s["id"]: s["reason"] for s in r["skipped"]}
        check("R15 bulk result lists updated and skipped", r["updated"] == 1 and lead1["id"] in reasons and 99999 in reasons, r)
        c.patch(f"{API}/users/{other_u['id']}", headers=admin, json={"is_active": False})
        check("R11 inactive owner rejected", c.post(f"{API}/leads/bulk-update", headers=admin, json={"lead_ids": [lead2["id"]], "owner_id": other_u["id"]}).status_code == 400)
        check("Sec13 bulk update needs staff", c.post(f"{API}/leads/bulk-update", headers=parent, json={"lead_ids": [lead2["id"]], "owner_id": None}).status_code == 403)
        admin_u = c.get(f"{API}/auth/me", headers=admin).json()
        hist = c.get(f"{API}/audit?entity_type=lead&entity_id={lead2['id']}", headers=admin).json()
        bulk = [h for h in hist if h["action"] == "lead.bulk_update"]
        check("R11/R26 assignment history recorded with user", bulk and bulk[0]["user_id"] == admin_u["id"] and bulk[0]["changes"]["owner_id"] == [None, other_u["id"]], hist)
        check("R26 audit log is admin-only", c.get(f"{API}/audit", headers=staff).status_code == 403)
        actions = {h["action"] for h in c.get(f"{API}/audit?limit=500", headers=admin).json()}
        check("R26 key actions audited", {"lead.create", "submission.create", "plagiarism.check", "review.decision", "payment.status", "publication.update", "writathon.create", "user.create", "user.update"} <= actions, actions)

        # ---- Req 18: access control
        check("Sec5 staff cannot change roles", c.patch(f"{API}/users/{staff_u['id']}", headers=staff, json={"role": "ADMIN"}).status_code == 403)
        admin_id = c.get(f"{API}/auth/me", headers=admin).json()["id"]
        check("Sec admin cannot change own role", c.patch(f"{API}/users/{admin_id}", headers=admin, json={"role": "STAFF"}).status_code == 400)
        check("Sec1 bad token -> 401", c.get(f"{API}/leads", headers={"Authorization": "Bearer junk"}).status_code == 401)
        for path in ("/leads/1", "/students", "/submissions", "/dashboard/stats", "/users", "/audit", "/emails/communications"):
            if c.get(f"{API}{path}").status_code != 401:
                check(f"Sec1 {path} requires auth", False)
        check("Sec1 staff endpoints require auth", True)

        # ---- Req 13: history survives event closure
        c.put(f"{API}/writathons/{w2}", headers=admin, json={"status": "COMPLETED"})
        hist = c.get(f"{API}/students/{lead1['student_id']}", headers=staff).json()
        check("R13 history across Writathons incl. completed event", {r["writathon_id"] for r in hist["registrations"]} == {w1, w2})
        check("R4 completed event refuses submissions", sub(lead2["lead_id"]).status_code == 400)

        # ---- Req 16: reports
        st = c.get(f"{API}/dashboard/stats", headers=staff).json()
        check("R16 report metrics", st["total_submissions"] == 1 and st["registered_not_submitted"] == 2 and st["awaiting_review"] == 0
              and st["eligible_decisions"] == 1 and st["conversion_rate"] == round(100 / 3, 1) and st["total_writathons"] == 3, st)
        check("R16 ownership distribution sums to total leads", sum(o["leads"] for o in st["owner_distribution"]) == st["total_leads"])

        # ---- Req 24: real delivery, failures, reminders
        settings.SMTP_HOST = "smtp.test"
        FakeSMTP.fail = True
        lead3 = reg(writathon_id=w1, child_name="Kabir Rao", parent_email="rao@example.com").json()
        with SessionLocal() as db:
            cl = db.query(CommunicationLog).filter(CommunicationLog.lead_id == lead3["id"]).one()
        check("R24 SMTP failure recorded as FAILED; registration still saved", cl.status.value == "FAILED" and lead3["status"] == "NEW", cl.error_message)
        FakeSMTP.fail = False
        lead4 = reg(writathon_id=w1, child_name="Meera Rao", parent_email="rao@example.com").json()
        check("R24 delivered confirmation -> CONTACTED", lead4["status"] == "CONTACTED" and FakeSMTP.sent[-1]["To"] == "rao@example.com")
        res = ReminderSchedulerService.process_pending_reminders(SessionLocal())
        check("R24 no reminder before day 3", res["sent"] == 0, res)
        with SessionLocal() as db:
            for lid in (lead4["id"], sib["id"]):
                db.get(Lead, lid).created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=4)
            db.commit()
        res = ReminderSchedulerService.process_pending_reminders(SessionLocal())
        sent_ids = {d["lead_id"] for d in res["details"] if d["status"] == "sent"}
        check("R24 day-3 reminders sent to non-submitters only", sent_ids == {lead4["lead_id"], sib["lead_id"]}, res)
        res = ReminderSchedulerService.process_pending_reminders(SessionLocal())
        check("R24 reminder not repeated before next interval", res["sent"] == 0, res)
        settings.SMTP_HOST = ""

        # ---- Sec9: rate limiting
        settings.RATE_LIMIT_PER_MINUTE = 3
        codes = [c.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "wrong"}).status_code for _ in range(5)]
        check("Sec9 repeated logins throttled (429)", codes[:3] == [401, 401, 401] and codes[3] == 429, codes)
        settings.RATE_LIMIT_PER_MINUTE = 0

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        raise SystemExit("FAILED: " + "; ".join(failed))


if __name__ == "__main__":
    main()
