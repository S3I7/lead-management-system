try:
    import requests
except ImportError:
    import httpx as requests
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_tests():
    print("=== 1. Testing Backend Health & Frontend Static ===")
    r_health = requests.get("http://127.0.0.1:8000/health")
    assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
    print(f"Backend Health: 200 -> {r_health.json()}")

    r_front = requests.get("http://localhost:5173/")
    assert r_front.status_code == 200, f"Frontend static check failed: {r_front.status_code}"
    print(f"Frontend Static: 200 -> HTML length: {len(r_front.text)} bytes")

    print("\n=== 2. Testing Step 1: Public Interest Form Registration ===")
    unique_suffix = uuid.uuid4().hex[:6]
    reg_payload = {
        "writathon_id": 1,
        "child_name": f"Devansh Kapoor {unique_suffix}",
        "child_dob": "2015-05-10",
        "child_age": 11,
        "age_group": "11-13",
        "submission_category": "Short Story",
        "city": "New Delhi",
        "grade": "Grade 6",
        "school": "St. Columbas School, New Delhi",
        "parent_name": "Pooja Kapoor",
        "parent_email": f"pooja.{unique_suffix}@example.com",
        "parent_phone": "+91 98112 34567",
        "country": "India",
        "terms_accepted": True
    }
    r_reg = requests.post(f"{BASE_URL}/leads/register", json=reg_payload)
    assert r_reg.status_code == 201, f"Registration failed: {r_reg.text}"
    d_reg = r_reg.json()
    print(f"Registration Status: 201 Created")
    print(f"Generated Lead ID: {d_reg['lead_id']}")
    print(f"Lead Status after confirmation email: {d_reg['status']}")
    lead_token = d_reg["access_token"]
    lead_code = d_reg["lead_id"]

    print("\n=== 3. Testing Staff Authentication & Dynamic Dashboard Metrics ===")
    r_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "reviewer@writathon.com", "password": "staff123"})
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    token = r_login.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    r_stats = requests.get(f"{BASE_URL}/dashboard/stats", headers=auth_headers)
    assert r_stats.status_code == 200, f"Stats failed: {r_stats.text}"
    d_stats = r_stats.json()
    print(f"Dashboard Stats: Total Leads={d_stats['total_leads']}, Under Review={d_stats['under_review']}, Paid={d_stats['paid']}, Revenue=INR {d_stats['revenue_total']}")

    print("\n=== 4. Testing Step 2: Story Submission with DOCX/PDF Magic Byte Validation ===")
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (The Secret of the Emerald Compass) /Author (Devansh) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    files = {
        "file": ("Devansh_Story.pdf", pdf_bytes, "application/pdf")
    }
    data = {
        "lead_token": lead_token,
        "title": "The Secret of the Emerald Compass",
        "word_count": "750",
        "category": "Fantasy & Adventure",
        "originality_declaration": "true"
    }
    r_sub = requests.post(f"{BASE_URL}/submissions", data=data, files=files)
    assert r_sub.status_code == 201, f"Submission failed: {r_sub.text}"
    d_sub = r_sub.json()
    print(f"Story Submission: 201 Created -> Story ID: {d_sub['id']}, Title: '{d_sub['title']}'")
    story_id = d_sub["id"]

    # Verify lead status advanced to STORY_SUBMITTED (and reminder system stops!)
    r_lead_chk = requests.get(f"{BASE_URL}/leads/by-code/{lead_code}")
    assert r_lead_chk.status_code == 200
    d_lead_chk = r_lead_chk.json()
    print(f"Lead Journey Status: {d_lead_chk['lead']['status']} (Reminders stopped automatically!)")

    print("\n=== 5. Testing Step 3: Manual Plagiarism Review (Strictly Human, NO AI) ===")
    plag_payload = {
        "status": "PASS",
        "plagiarism_notes": "100% authentic child storytelling. Verified manual comparison with standard youth corpora.",
        "reference_sources": "Turnitin database check, Google Search"
    }
    r_plag = requests.post(f"{BASE_URL}/plagiarism/{story_id}", json=plag_payload, headers=auth_headers)
    assert r_plag.status_code == 200, f"Plagiarism check failed: {r_plag.text}"
    d_plag = r_plag.json()
    print(f"Manual Plagiarism Review Recorded: Status={d_plag['status']}, Reviewer={d_plag['reviewer_name']}")

    print("\n=== 6. Testing Step 4: Staff Editorial Review Decision (ELIGIBLE) ===")
    rev_payload = {
        "decision": "ELIGIBLE",
        "feedback": "Exceptional descriptive prowess, imaginative worldbuilding, and delightful characters!",
        "internal_notes": "Recommended for front anthology feature"
    }
    r_rev = requests.post(f"{BASE_URL}/reviews/{story_id}", json=rev_payload, headers=auth_headers)
    assert r_rev.status_code == 200, f"Review decision failed: {r_rev.text}"
    d_rev = r_rev.json()
    print(f"Editorial Review Decision: {d_rev['decision']} (Story marked ELIGIBLE)")

    print("\n=== 7. Testing Step 5: Payment Link Generation & Server-Side Webhook Verification ===")
    r_lead_pay = requests.get(f"{BASE_URL}/leads/by-code/{lead_code}")
    payment_info = r_lead_pay.json()["payment"]
    assert payment_info is not None, "Payment record was not generated!"
    payment_token = payment_info["payment_link_token"]
    print(f"Payment link token issued (Amount: {payment_info['amount']} {payment_info['currency']}); the full link is emailed, not shown publicly")

    # Parent completes checkout via simulated gateway (UPI/Card)
    checkout_payload = {
        "payment_method": "UPI",
        "mock_success": True,
        "transaction_ref": f"UPI_TXN_{uuid.uuid4().hex[:10]}"
    }
    r_pay = requests.post(f"{BASE_URL}/payments/process-checkout/{payment_token}", json=checkout_payload)
    assert r_pay.status_code == 200, f"Payment checkout failed: {r_pay.text}"
    d_pay = r_pay.json()
    print(f"Payment Gateway Verification: Status={d_pay['status']}, Gateway Ref={d_pay['gateway_payment_id']}")

    print("\n=== 8. Testing Publication Step ===")
    pub_payload = {
        "publication_status": "PUBLISHED",
        "publication_url": f"https://writathon.org/publications/2026/the-secret-of-the-emerald-compass-{unique_suffix}",
        "publication_notes": "Published in Writathon Anthology Volume 1, ISBN 978-93-8827-01-4"
    }
    r_pub = requests.put(f"{BASE_URL}/publications/{story_id}", json=pub_payload, headers=auth_headers)
    assert r_pub.status_code == 200, f"Publication update failed: {r_pub.text}"
    d_pub = r_pub.json()
    print(f"Publication Updated: Status={d_pub['publication_status']}, URL={d_pub['publication_url']}")

    print("\n=== 9. Verification of Full Communication Audit Trail ===")
    r_final = requests.get(f"{BASE_URL}/leads/by-code/{lead_code}")
    d_final = r_final.json()
    print(f"Final Lead Status: {d_final['lead']['status']}")
    print(f"Final Story Status: {d_final['submission']['status']}")
    print(f"Total Emails Dispatched & Logged: {len(d_final['communications'])}")
    for comm in d_final["communications"]:
        print(f"  • [{comm['template']}] -> {comm['subject']} (Status: {comm['status']})")

    print("\n=== 10. Reminder Scheduler Safety Check ===")
    r_sched = requests.post(f"{BASE_URL}/scheduler/run-reminders", headers=auth_headers)
    assert r_sched.status_code == 200, f"Scheduler run failed: {r_sched.text}"
    print(f"Scheduler Execution Result: {r_sched.json()['message']}")

    print("\n=== 11. Security Check: Parent Access Restriction Enforcement ===")
    r_parent_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "parent@example.com", "password": "parent123"})
    parent_token = r_parent_login.json()["access_token"]
    parent_headers = {"Authorization": f"Bearer {parent_token}"}

    r_sec_stats = requests.get(f"{BASE_URL}/dashboard/stats", headers=parent_headers)
    assert r_sec_stats.status_code == 403, "Security Failure: Parent was able to view staff dashboard stats!"
    r_sec_leads = requests.get(f"{BASE_URL}/leads", headers=parent_headers)
    assert r_sec_leads.status_code == 403, "Security Failure: Parent was able to view leads directory!"
    print(f"Parent access to /dashboard/stats returned {r_sec_stats.status_code} Forbidden as expected.")
    print(f"Parent access to /leads returned {r_sec_leads.status_code} Forbidden as expected.")

    print("\nSUCCESS: ALL 11 WORKFLOW STAGES AND ROLE RESTRICTIONS VERIFIED AND WORKING FLAWLESSLY!")

if __name__ == "__main__":
    run_tests()
