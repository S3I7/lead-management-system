"""Edge cases, token validation, and concurrency stress checks for the audit.
Usage: python test_edge_cases.py
"""
import concurrent.futures
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token

def test_jwt_claims():
    print("--- Testing JWT Claims and Validation ---")
    with TestClient(app, raise_server_exceptions=False) as client:
        # 1. Non-integer sub claim
        bad_token = create_access_token(data={"sub": "alphanumeric_user_id", "role": "STAFF"})
        res = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {bad_token}"})
        if res.status_code == 500:
            print("[FAIL/BUG] Non-integer JWT 'sub' causes 500 Internal Server Error (expected 401)")
        elif res.status_code == 401:
            print("[PASS] Non-integer JWT 'sub' returns 401 Unauthorized")
        else:
            print(f"[NOTE] Non-integer JWT 'sub' returned {res.status_code}")

        # 2. Expired token
        expired_token = jwt.encode(
            {"sub": "1", "role": "ADMIN", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        res_exp = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {expired_token}"})
        assert res_exp.status_code == 401, f"Expired token must be 401, got {res_exp.status_code}"
        print("[PASS] Expired JWT correctly rejected with 401 Unauthorized")

        # 3. Missing sub claim
        no_sub_token = jwt.encode(
            {"role": "ADMIN", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        res_no_sub = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {no_sub_token}"})
        assert res_no_sub.status_code == 401, f"Missing sub must be 401, got {res_no_sub.status_code}"
        print("[PASS] JWT without 'sub' claim correctly rejected with 401 Unauthorized")

def test_health_check_depth():
    print("\n--- Testing Health Check Depth & DB Probe ---")
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy", f"Status must be healthy, got {data}"
        assert data.get("database") == "connected", f"Database must be connected, got {data}"
        print(f"[PASS] /health actively probes database: {data}")

def test_export_audit_logging():
    print("\n--- Testing CSV Export Audit Logging ---")
    with TestClient(app) as client:
        # 1. Unauthenticated export audit must be rejected
        res_anon = client.post("/api/v1/leads/export-audit", json={"count": 5, "lead_ids": [1, 2, 3]})
        assert res_anon.status_code == 401, f"Expected 401 for unauthenticated export audit, got {res_anon.status_code}"

        # 2. Authenticated staff export audit must be logged
        staff_token = create_access_token(data={"sub": "1", "role": "STAFF"})
        res_staff = client.post(
            "/api/v1/leads/export-audit",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"count": 10, "lead_ids": [1, 2, 3, 4, 5]}
        )
        assert res_staff.status_code == 200, f"Expected 200 for staff export audit, got {res_staff.status_code}"
        assert res_staff.json().get("status") == "ok"

        # 3. Verify in audit logs (admin-only)
        admin_token = create_access_token(data={"sub": "1", "role": "ADMIN"})
        res_audit = client.get(
            "/api/v1/audit?action=lead.export_csv",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_audit.status_code == 200
        logs = res_audit.json()
        assert len(logs) > 0, "Audit log must contain lead.export_csv entry"
        assert logs[0]["changes"]["exported_count"] == 10
        print("[PASS] CSV export audit logging verified and saved in audit_logs")

def test_concurrent_student_registration():
    print("\n--- Testing Concurrent New Student Registration ---")
    unique_suffix = datetime.now().strftime("%f")
    payload = {
        "writathon_id": 1,
        "child_name": f"Stress Child {unique_suffix}",
        "parent_name": "Stress Parent",
        "parent_email": f"stress.{unique_suffix}@example.com",
        "parent_phone": "+91 91234 56789",
        "age_group": "8-10",
        "submission_category": "Short Story",
        "grade": "Grade 4",
        "school": "St Mary",
        "city": "Bengaluru",
        "country": "India",
        "terms_accepted": True
    }

    results = []
    def call_register(_):
        with TestClient(app, raise_server_exceptions=False) as client:
            try:
                r = client.post("/api/v1/leads/register", json=payload)
                return r.status_code
            except Exception as e:
                return f"Exception: {type(e).__name__}"

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(call_register, i) for i in range(4)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    print(f"Results of 4 concurrent registrations for new student: {results}")
    if any(r == 500 or str(r).startswith("Exception") for r in results):
        print("[FAIL/RACE CONDITION] Concurrent registration for new student raised 500 or uncaught IntegrityError!")
    else:
        print("[PASS] Concurrent registrations handled cleanly without 500")

if __name__ == "__main__":
    test_jwt_claims()
    test_health_check_depth()
    test_export_audit_logging()
    test_concurrent_student_registration()
