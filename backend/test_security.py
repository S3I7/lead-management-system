"""Self-check for auth, payments, lead dedupe and filters. Run: python test_security.py (no server needed)."""
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
    "ADMIN_EMAIL": "boss@example.com",
    "ADMIN_PASSWORD": "boss-pass-123",
    "PAYMENT_WEBHOOK_SECRET": "whsec",
})

from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.services.email_service import EmailService

API = "/api/v1"

def main():
    with TestClient(app) as c:
        # Fix 1: no unauthenticated role switch
        assert c.post(f"{API}/auth/quick-switch/admin").status_code in (404, 405)

        admin = {"Authorization": "Bearer " + c.post(f"{API}/auth/login", json={"email": "Boss@example.com", "password": "boss-pass-123"}).json()["access_token"]}
        r = c.post(f"{API}/users", headers=admin, json={"email": "staff@example.com", "password": "staff-pass-1", "full_name": "Staff One", "role": "STAFF"})
        assert r.status_code == 201, r.text
        staff_id = r.json()["id"]
        staff = {"Authorization": "Bearer " + c.post(f"{API}/auth/login", json={"email": "staff@example.com", "password": "staff-pass-1"}).json()["access_token"]}
        assert c.post(f"{API}/users", headers=staff, json={"email": "x@example.com", "password": "12345678", "full_name": "X"}).status_code == 403

        now = datetime.now(timezone.utc)
        def make_writathon(code):
            r = c.post(f"{API}/writathons", headers=admin, json={
                "name": f"Writathon {code}", "code": code, "start_date": now.isoformat(),
                "end_date": (now + timedelta(days=60)).isoformat(), "submission_deadline": (now + timedelta(days=30)).isoformat()})
            assert r.status_code == 201, r.text
            return r.json()["id"]
        w1, w2 = make_writathon("W1"), make_writathon("W2")

        form = {"child_name": "Aarav Sharma", "age_group": "8-10", "submission_category": "Short Story", "city": "Chennai", "grade": "Grade 5", "school": "DPS",
                "parent_name": "Pooja", "parent_email": "Pooja@Example.com", "parent_phone": "+91 98765 43210",
                "country": "India", "terms_accepted": True}
        lead1 = c.post(f"{API}/leads/register", json={**form, "writathon_id": w1}).json()
        # Fix 3: tracking ID is random, not a counter
        assert lead1["lead_id"].startswith("WR-") and len(lead1["lead_id"].split("-")[2]) == 8, lead1["lead_id"]
        # Requirement 17: same student, different case email -> same Student, same registration in same Writathon
        again = c.post(f"{API}/leads/register", json={**form, "parent_email": "pooja@example.com", "child_name": "aarav sharma", "writathon_id": w1}).json()
        assert again["id"] == lead1["id"]
        lead2 = c.post(f"{API}/leads/register", json={**form, "writathon_id": w2}).json()
        assert lead2["id"] != lead1["id"] and lead2["student_id"] == lead1["student_id"]

        # Requirement 13: history across Writathons
        hist = c.get(f"{API}/students/{lead1['student_id']}", headers=staff).json()
        assert {r["writathon_id"] for r in hist["registrations"]} == {w1, w2}

        # Submit story by tracking ID typed in lowercase; then the duplicate path must not leak the ID
        pdf = b"%PDF-1.4\n%%EOF"
        r = c.post(f"{API}/submissions", data={"lead_token": lead1["lead_id"].lower(), "title": "T", "originality_declaration": "true"},
                   files={"file": ("s.pdf", pdf, "application/pdf")})
        assert r.status_code == 201, r.text
        story_id = r.json()["id"]
        assert c.post(f"{API}/leads/register", json={**form, "writathon_id": w1}).status_code == 409
        # Requirement 8: filter by the registration-form fields
        assert {l["id"] for l in c.get(f"{API}/leads?submission_category=Short Story&age_group=8-10&search=Chennai", headers=staff).json()} == {lead1["id"], lead2["id"]}
        assert c.get(f"{API}/leads?submission_category=Poem", headers=staff).json() == []
        # Requirement 1/4: admins edit a Writathon; closing it blocks new stories
        assert c.put(f"{API}/writathons/{w2}", headers=staff, json={"status": "SUBMISSIONS_CLOSED"}).status_code == 403
        assert c.put(f"{API}/writathons/{w2}", headers=admin, json={"status": "SUBMISSIONS_CLOSED", "submission_fee": 599}).json()["submission_fee"] == 599
        r = c.post(f"{API}/submissions", data={"lead_token": lead2["lead_id"], "title": "T2", "originality_declaration": "true"},
                   files={"file": ("s.pdf", pdf, "application/pdf")})
        assert r.status_code == 400 and "closed" in r.json()["detail"], r.text
        # Requirement 18: disabled staff lose access immediately; parents/anonymous never see staff data
        tmp_staff = c.post(f"{API}/users", headers=admin, json={"email": "temp@example.com", "password": "temp-pass-1", "full_name": "Temp"}).json()
        tmp_hdr = {"Authorization": "Bearer " + c.post(f"{API}/auth/login", json={"email": "temp@example.com", "password": "temp-pass-1"}).json()["access_token"]}
        assert c.get(f"{API}/leads", headers=tmp_hdr).status_code == 200
        c.patch(f"{API}/users/{tmp_staff['id']}", headers=admin, json={"is_active": False})
        assert c.get(f"{API}/leads", headers=tmp_hdr).status_code == 401
        for path in ("/leads", "/students", "/submissions", "/dashboard/stats", "/users"):
            assert c.get(f"{API}{path}").status_code == 401, path
        assert c.get(f"{API}/submissions/{story_id}").status_code == 401

        # Requirements 8-11: filters, ownership, bulk update
        ids = lambda q: {l["id"] for l in c.get(f"{API}/leads?{q}", headers=staff).json()}
        assert ids("submitted=true") == {lead1["id"]} and ids("submitted=false") == {lead2["id"]}  # requirements 9 & 10
        assert c.post(f"{API}/leads/bulk-update", headers=staff, json={"lead_ids": [lead1["id"], lead2["id"]], "owner_id": staff_id}).json()["updated"] == 2
        assert ids(f"owner_id={staff_id}") == {lead1["id"], lead2["id"]} and ids("owner_id=0") == set()
        assert c.post(f"{API}/leads/bulk-update", headers=staff, json={"lead_ids": [lead2["id"]], "owner_id": None}).json()["updated"] == 1
        assert ids("owner_id=0") == {lead2["id"]}
        subs = c.get(f"{API}/submissions?writathon_id={w1}", headers=staff).json()
        assert [s["lead_code"] for s in subs] == [lead1["lead_id"]]
        report = {w["writathon_id"]: w for w in c.get(f"{API}/dashboard/stats", headers=staff).json()["by_writathon"]}
        assert report[w1]["submissions"] == 1 and report[w2]["not_submitted"] == 1

        # Fix 2: payments only through a signed webhook
        assert c.post(f"{API}/reviews/{story_id}", headers=staff, json={"decision": "ELIGIBLE"}).status_code == 200
        pay = c.get(f"{API}/leads/by-code/{lead1['lead_id']}").json()["payment"]
        assert c.post(f"{API}/payments/process-checkout/{pay['payment_link_token']}", json={}).status_code == 403
        def hook(amount, sign=True):
            body = json.dumps({"event": "payment.captured", "payment_link_token": pay["payment_link_token"],
                               "gateway_payment_id": "pay_1", "amount": amount, "status": "captured"}).encode()
            sig = hmac.new(b"whsec", body, hashlib.sha256).hexdigest() if sign else "bad"
            return c.post(f"{API}/payments/webhook", content=body, headers={"X-Webhook-Signature": sig, "Content-Type": "application/json"})
        assert hook(pay["amount"], sign=False).status_code == 401
        assert hook(1.0).status_code == 400
        assert hook(pay["amount"]).json()["payment_status"] == "PAID"

    # Fix 5: values are HTML-escaped in emails
    assert EmailService.render_template("<p>{{x}}</p>", {"x": "<img onerror=a>"}) == "<p>&lt;img onerror=a&gt;</p>"
    print("All security & lead checks passed.")

if __name__ == "__main__":
    main()
