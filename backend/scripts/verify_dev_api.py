"""Read-only API checks against the running local backend and dev seed.

Run from backend: ..\\.venv\\Scripts\\python.exe -m scripts.verify_dev_api
"""

import requests

BASE = "http://127.0.0.1:8000"
PASSWORDS = {
    "student@demo.local": "password123",
    "student02@demo.local": "password123",
    "instructor@demo.local": "password123",
    "admin@demo.local": "123",
}


def login(email, password):
    response = requests.post(BASE + "/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert response.status_code == 200, (email, response.status_code, response.text)
    return response.json()["access_token"]


def call(token, method, path, expected=200, **kwargs):
    response = requests.request(method, BASE + path,
        headers={"Authorization": f"Bearer {token}"}, timeout=25, **kwargs)
    assert response.status_code == expected, (method, path, expected, response.status_code, response.text[:500])
    return response.json()


def verify():
    student = login("student@demo.local", PASSWORDS["student@demo.local"])
    other = login("student02@demo.local", PASSWORDS["student02@demo.local"])
    teacher = login("instructor@demo.local", PASSWORDS["instructor@demo.local"])
    admin = login("admin@demo.local", PASSWORDS["admin@demo.local"])
    for email in ("pending.lecturer@demo.local", "inactive.student@demo.local"):
        response = requests.post(BASE + "/api/auth/login", json={"email": email, "password": "password123"}, timeout=15)
        assert response.status_code == 403, (email, response.status_code)

    dashboard = call(student, "GET", "/api/student/dashboard")
    assert set(("solved", "easy", "medium", "hard", "submissionsPerDay")) <= dashboard.keys()
    enrolled = call(student, "GET", "/api/student/assignments")
    assert {"IS207.R11", "IS201.R12"} <= {c["id"] for c in enrolled["classes"]}
    assert "dev-assignment-draft" not in {a["id"] for a in enrolled["assignments"]}
    assert "dev-assignment-open" in {a["id"] for a in enrolled["assignments"]}
    assert not any("groupId" in a for a in enrolled["assignments"])
    assert not any("mode" in c for c in enrolled["classes"])
    assert set(next(a for a in enrolled["assignments"] if a["id"] == "dev-assignment-open")["classIds"]) == {"IS207.R11", "IS201.R12"}
    catalog = call(student, "GET", "/api/assignments")
    assert "dev-assignment-draft" not in {a["id"] for a in catalog}
    assert "dev-assignment-scheduled" in {a["id"] for a in catalog}
    assert call(student, "GET", "/api/assignments/dev-assignment-open")["problemList"] == [
        {"id": "dev-select", "points": 10}, {"id": "dev-group", "points": 20},
        {"id": "dev-join", "points": 30}, {"id": "dev-null", "points": 20},
    ]
    call(student, "GET", "/api/assignments/dev-assignment-draft", 403)
    call(student, "GET", "/api/assignments/no-such-assignment", 404)
    call(other, "GET", "/api/assignments/dev-contest-open", 403)

    problems = call(student, "GET", "/api/problems")
    assert sum(p["practiceListed"] for p in problems) >= 8
    assert call(student, "GET", "/api/problems/dev-join")["referenceSolution"] == ""
    call(student, "GET", "/api/problems/no-such-problem", 404)
    call(other, "GET", "/api/problems/dev-cte", 403)
    query = {"query": "SELECT customer_id, customer_name FROM Customers ORDER BY customer_id;",
             "source": "Practice", "context": "Practice", "database": "SQL Server"}
    run = call(student, "POST", "/api/problems/dev-select/run", json=query)
    assert run["status"] == "Tabular result" and len(run["table"]["rows"]) == 5
    call(student, "POST", "/api/problems/dev-join/run", 403, json=query)
    call(student, "POST", "/api/problems/dev-select/submit", 403, json={**query, "source": "Assignments", "context": "dev-assignment-draft"})
    call(student, "POST", "/api/problems/dev-order/submit", 403, json={**query, "source": "Assignments", "context": "dev-assignment-scheduled"})
    call(student, "POST", "/api/problems/dev-where/submit", 403, json={**query, "source": "Assignments", "context": "dev-assignment-closed"})
    call(other, "POST", "/api/problems/dev-cte/submit", 403, json={**query, "source": "Contests", "context": "dev-contest-open"})
    call(student, "POST", "/api/problems/validate", 403, json={"database": "SQL Server", "schema": "", "seedData": "", "referenceSolution": "SELECT 1"})

    submissions = call(student, "GET", "/api/submissions")
    assert len(submissions) >= 3
    assert call(student, "GET", "/api/submissions?search=no-match-at-all") == []
    call(student, "GET", "/api/submissions/dev-sub-open-one-group", 403)
    call(student, "PUT", "/api/submissions/dev-sub-closed-demo-pass/review", 403,
         json={"finalScore": 75, "feedback": "not allowed"})
    call(student, "GET", "/api/assignments/dev-assignment-open/submissions", 403)
    call(student, "GET", "/api/teacher/classes", 403)
    call(student, "GET", "/api/admin/users", 403)

    teacher_problems = call(teacher, "GET", "/api/problems")
    assert sum(not p["practiceListed"] for p in teacher_problems) >= 3
    assert call(teacher, "GET", "/api/problems/dev-cte")["referenceSolution"].startswith("WITH")
    assert len(call(teacher, "GET", "/api/teacher/classes")) >= 2
    activities = call(teacher, "GET", "/api/assignments")
    assert len([a for a in activities if a["isContest"]]) >= 3
    assert all("format" not in activity for activity in activities)
    results = call(teacher, "GET", "/api/assignments/dev-assignment-open/submissions")
    assert results and all(r["student"] and r["problem"] for r in results)
    reviewed = call(teacher, "GET", "/api/submissions/dev-sub-open-one-group")
    assert reviewed["finalScore"] == 92 and reviewed["feedback"]
    call(teacher, "PUT", "/api/submissions/dev-sub-open-one-group/review", 422,
         json={"finalScore": 101, "feedback": "invalid"})
    call(teacher, "GET", "/api/admin/users", 403)

    users = call(admin, "GET", "/api/admin/users")
    assert len(users) >= 12 and {u["status"] for u in users} >= {"Active", "Inactive", "Pending"}
    assert len(call(admin, "GET", "/api/admin/users/lecturer-requests")) >= 1
    assert len(call(admin, "GET", "/api/admin/classes")) >= 3
    stats = call(admin, "GET", "/api/admin/overview/stats")
    assert stats["users"] == len(users) and stats["unassignedClasses"] >= 1
    assert call(admin, "GET", "/api/admin/overview/activities")
    assert call(admin, "GET", "/api/admin/overview/errors")
    assert len(call(admin, "GET", "/api/problems")) >= 11
    print("PASS: real auth, role guards, student catalog/schedules/SQL, teacher classes/results/review, admin data/metrics, invalid IDs, private access, inactive/pending users.")


if __name__ == "__main__":
    verify()
