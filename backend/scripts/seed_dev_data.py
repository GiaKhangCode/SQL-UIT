r"""Idempotent, local-only data for exercising the SQL-UIT product flows.

Run from backend with: ..\.venv\Scripts\python.exe -m scripts.seed_dev_data
The small, normal seed in scripts.seed remains separate.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.database import SessionLocal
from app.models import (
    ActivityLog, Assignment, AssignmentClass, AssignmentProblem, Class,
    ClassEnrollment, Problem, ProblemTopic, Submission, TestCase,
    TestCaseScript, Topic, User,
)
from app.security import get_password_hash


CUSTOMER_SCHEMA = "CREATE TABLE Customers (customer_id INT, customer_name VARCHAR(80), city VARCHAR(40) NULL);"
CUSTOMER_SEED = (
    "INSERT INTO Customers VALUES (1, 'Ava Reed', 'Hanoi'), (2, 'Ben Tran', NULL), "
    "(3, 'Cora Pham', 'Da Nang'), (4, 'Dylan Le', 'Hanoi'), (5, 'Ella Vo', NULL);"
)
ORDER_SCHEMA = "CREATE TABLE Orders (order_id INT, customer_id INT, amount INT);"
ORDER_SEED = (
    "INSERT INTO Orders VALUES (101, 1, 120), (102, 1, 80), (103, 2, 210), "
    "(104, 3, 40), (105, 3, 160), (106, 4, 90);"
)
PRODUCT_SCHEMA = "CREATE TABLE Products (product_id INT, product_name VARCHAR(80), category VARCHAR(40), price INT);"
PRODUCT_SEED = (
    "INSERT INTO Products VALUES (1, 'Keyboard', 'Accessories', 75), "
    "(2, 'Monitor', 'Displays', 260), (3, 'Mouse', 'Accessories', 35), "
    "(4, 'Desk Lamp', 'Office', 55);"
)


PROBLEMS = [
    dict(id="dev-select", number="101", title="Customer directory", difficulty="Easy", topics=["SELECT"], public=True,
         description="List every customer and their name.", requirements="Return customer_id and customer_name in customer_id order.",
         hint="Choose the two requested columns and sort by the ID.", schema=CUSTOMER_SCHEMA, seed=CUSTOMER_SEED,
         solution="SELECT customer_id, customer_name FROM Customers ORDER BY customer_id;"),
    dict(id="dev-where", number="102", title="Orders over 100", difficulty="Easy", topics=["WHERE"], public=True,
         description="Find orders whose amount is greater than 100.", requirements="Return order_id and amount, ordered by order_id.",
         hint="Filter with WHERE amount > 100.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="SELECT order_id, amount FROM Orders WHERE amount > 100 ORDER BY order_id;"),
    dict(id="dev-order", number="103", title="Highest priced products", difficulty="Easy", topics=["ORDER BY"], public=True,
         description="Show products from highest to lowest price.", requirements="Return product_name and price; break price ties by product_name.",
         hint="Use DESC for price and ASC for the tie break.", schema=PRODUCT_SCHEMA, seed=PRODUCT_SEED,
         solution="SELECT product_name, price FROM Products ORDER BY price DESC, product_name ASC;"),
    dict(id="dev-group", number="104", title="Orders per customer", difficulty="Medium", topics=["GROUP BY"], public=True,
         description="Count orders placed by each customer who has ordered.", requirements="Return customer_id and order_count, ordered by customer_id.",
         hint="Group the rows by customer_id.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="SELECT customer_id, COUNT(*) AS order_count FROM Orders GROUP BY customer_id ORDER BY customer_id;"),
    dict(id="dev-having", number="105", title="Frequent shoppers", difficulty="Medium", topics=["HAVING"], public=True,
         description="Find customers who placed at least two orders.", requirements="Return customer_id and order_count, ordered by customer_id.",
         hint="Filter aggregate groups with HAVING.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="SELECT customer_id, COUNT(*) AS order_count FROM Orders GROUP BY customer_id HAVING COUNT(*) >= 2 ORDER BY customer_id;"),
    dict(id="dev-join", number="106", title="Customer spending", difficulty="Medium", topics=["JOIN"], public=False,
         description="Calculate total spending for customers with orders.", requirements="Return customer_id, customer_name and total_spent, ordered by customer_id.",
         hint="Join Customers to Orders, then aggregate the amounts.", schema=CUSTOMER_SCHEMA + "\n" + ORDER_SCHEMA,
         seed=CUSTOMER_SEED + "\n" + ORDER_SEED,
         solution="SELECT c.customer_id, c.customer_name, SUM(o.amount) AS total_spent FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.customer_name ORDER BY c.customer_id;"),
    dict(id="dev-null", number="107", title="Customers missing a city", difficulty="Medium", topics=["NULL"], public=True,
         description="Find customer profiles with no city recorded.", requirements="Return customer_id and customer_name, ordered by customer_id.",
         hint="Compare nullable values with IS NULL.", schema=CUSTOMER_SCHEMA, seed=CUSTOMER_SEED,
         solution="SELECT customer_id, customer_name FROM Customers WHERE city IS NULL ORDER BY customer_id;"),
    dict(id="dev-subquery", number="108", title="Above average orders", difficulty="Hard", topics=["SUBQUERY"], public=True,
         description="Find orders larger than the average order amount.", requirements="Return order_id and amount, ordered by order_id.",
         hint="Calculate the average in a scalar subquery.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="SELECT order_id, amount FROM Orders WHERE amount > (SELECT AVG(CAST(amount AS FLOAT)) FROM Orders) ORDER BY order_id;"),
    dict(id="dev-cte", number="109", title="High value customers", difficulty="Hard", topics=["CTE"], public=False,
         description="Use a common table expression to total each customer's orders.", requirements="Return customer_id and total_spent for totals of at least 150, ordered by customer_id.",
         hint="Build totals in a CTE, then filter the CTE rows.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="WITH CustomerTotals AS (SELECT customer_id, SUM(amount) AS total_spent FROM Orders GROUP BY customer_id) SELECT customer_id, total_spent FROM CustomerTotals WHERE total_spent >= 150 ORDER BY customer_id;"),
    dict(id="dev-window", number="110", title="Rank each customer's orders", difficulty="Hard", topics=["WINDOW FUNCTION"], public=False,
         description="Number each customer's orders from largest amount to smallest.", requirements="Return customer_id, order_id and purchase_rank; order the final rows by customer_id and purchase_rank.",
         hint="Use ROW_NUMBER with PARTITION BY customer_id.", schema=ORDER_SCHEMA, seed=ORDER_SEED,
         solution="SELECT customer_id, order_id, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC, order_id) AS purchase_rank FROM Orders ORDER BY customer_id, purchase_rank;"),
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def upsert(db, model, record_id, values, counts, category):
    record = db.get(model, record_id)
    if record is None:
        record = model(id=record_id, **values)
        db.add(record)
        counts[category][0] += 1
    else:
        for key, value in values.items():
            setattr(record, key, value)
        counts[category][1] += 1
    return record


def ensure_user(db, email, record_id, name, role, status, counts):
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(id=record_id, email=email, name=name, initials="".join(part[0] for part in name.split()[:2]).upper(),
                    hashed_password=get_password_hash("password123"), role=role, status=status,
                    department="Development fixture" if role == "instructor" else "")
        db.add(user)
        counts["users"][0] += 1
    else:
        user.name = name
        user.role = role
        user.status = status
        counts["users"][1] += 1
    return user


def seed():
    db = SessionLocal()
    counts = {name: [0, 0] for name in ("users", "classes", "problems", "assignments", "contests", "submissions", "activity_logs")}
    try:
        database, server = db.execute(text("SELECT DB_NAME(), @@SERVERNAME")).one()
        if database.upper() != "SQLUIT" or "LOCALDB" not in server.upper():
            raise RuntimeError(f"Refusing to seed non-local SQLUIT database: {database} on {server}")

        # Older local databases created users.name as VARCHAR, which replaces
        # Vietnamese characters with '?' before the browser ever sees them.
        name_type = db.execute(text("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                                    "WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'name'")).scalar()
        if name_type == "varchar":
            db.execute(text("ALTER TABLE users ALTER COLUMN name NVARCHAR(255) NOT NULL"))

        demo_student = db.query(User).filter(User.email == "student@demo.local", User.role == "student").one()
        lecturer = db.query(User).filter(User.email == "instructor@demo.local", User.role == "instructor").one()
        admin = db.query(User).filter(User.email == "admin@demo.local", User.role == "admin").one()
        for user in (demo_student, lecturer, admin):
            if user.status != "Active":
                raise RuntimeError(f"Demo account {user.email} is not active; refusing to alter it")
            counts["users"][1] += 1
        lecturer.name = "Giảng Viên"
        admin.name = "Quản Trị Viên"

        students = [demo_student]
        for index in range(1, 8):
            students.append(ensure_user(db, f"student{index:02d}@demo.local", f"dev-student-{index:02d}",
                                        f"Demo Student {index:02d}", "student", "Active", counts))
        ensure_user(db, "pending.lecturer@demo.local", "dev-pending-lecturer", "Demo Pending Lecturer", "instructor", "Pending", counts)
        ensure_user(db, "inactive.student@demo.local", "dev-inactive-student", "Demo Inactive Student", "student", "Inactive", counts)
        db.flush()

        term = "Semester 1, 2026"
        today = now_utc().date()
        class_specs = [
            ("IS207.R11", "Web Development", lecturer.id, "Active", students[:6]),
            ("IS201.R12", "Database Systems", lecturer.id, "Active", [students[0], *students[3:8]]),
            ("IS207.R99", "Independent Lab", None, "Active", students[1:3]),
        ]
        for class_id, course, instructor_id, status, members in class_specs:
            upsert(db, Class, class_id, dict(course=course, term=term, instructor_id=instructor_id,
                                            start_date=str(today - timedelta(days=14)), end_date=str(today + timedelta(days=100)),
                                            status=status), counts, "classes")
            db.flush()
            for member in members:
                if db.get(ClassEnrollment, (class_id, member.id)) is None:
                    db.add(ClassEnrollment(class_id=class_id, student_id=member.id, role="Member"))

        topic_cache = {topic.name: topic for topic in db.query(Topic).all()}
        for spec in PROBLEMS:
            upsert(db, Problem, spec["id"], dict(number=spec["number"], title=spec["title"],
                topic=", ".join(spec["topics"]), topics=spec["topics"], difficulty=spec["difficulty"],
                description=spec["description"], requirements=spec["requirements"], hint=spec["hint"],
                practice_listed=spec["public"], database_type="SQL Server", creator_id=lecturer.id), counts, "problems")
            db.flush()
            db.query(ProblemTopic).filter(ProblemTopic.problem_id == spec["id"]).delete(synchronize_session=False)
            for name in spec["topics"]:
                if name not in topic_cache:
                    topic_cache[name] = Topic(id=f"dev-topic-{name.lower().replace(' ', '-')}", name=name)
                    db.add(topic_cache[name])
                    db.flush()
                db.add(ProblemTopic(problem_id=spec["id"], topic_id=topic_cache[name].id))
            upsert(db, TestCase, f"dev-test-{spec['id']}", dict(problem_id=spec["id"], is_hidden=False,
                order_index=1, expected_query=spec["solution"]), {"test": [0, 0]}, "test")
            db.flush()
            upsert(db, TestCaseScript, f"dev-script-{spec['id']}", dict(test_case_id=f"dev-test-{spec['id']}",
                table_name="Fixture", create_script=spec["schema"], insert_script=spec["seed"], is_expected=False),
                {"script": [0, 0]}, "script")
        db.flush()

        current = now_utc()
        activities = [
            ("dev-assignment-draft", "Draft SQL warm-up", False, False, 1, 8, ["IS207.R11"], [("dev-select", 10), ("dev-where", 15)]),
            ("dev-assignment-scheduled", "Next week's database lab", False, True, 3, 10, ["IS201.R12"], [("dev-order", 10), ("dev-having", 20), ("dev-subquery", 30)]),
            ("dev-assignment-open", "Customer analytics lab", False, True, -2, 7, ["IS207.R11", "IS201.R12"], [("dev-select", 10), ("dev-group", 20), ("dev-join", 30), ("dev-null", 20)]),
            ("dev-assignment-closed", "Completed SQL foundations", False, True, -21, -2, ["IS207.R11"], [("dev-where", 10), ("dev-order", 15), ("dev-having", 25)]),
            ("dev-contest-upcoming", "Upcoming query sprint", True, True, 2, 2 + 1 / 24, ["IS207.R11"], [("dev-subquery", 30), ("dev-window", 40)]),
            ("dev-contest-open", "Live SQL challenge", True, True, -1 / 48, 1 / 16, ["IS201.R12"], [("dev-cte", 40), ("dev-window", 40)]),
            ("dev-contest-ended", "Past leaderboard challenge", True, True, -5, -5 + 1 / 16, ["IS207.R11"], [("dev-order", 20), ("dev-group", 30)]),
            ("dev-contest-all", "Campus SQL Sprint", True, True, 4, 4 + 1 / 12, [], [("dev-join", 30), ("dev-subquery", 40)]),
        ]
        contest_copy = {
            "dev-contest-upcoming": ("A one-hour SQL challenge for Web Development students.",
                "## About the sprint\nPractice analytical SQL in a focused class challenge. Expect subqueries and window functions.",
                "Problems unlock at the start. Each problem has a score. Submissions close at the end. Ranking uses best score per problem."),
            "dev-contest-open": ("A live database challenge covering CTEs and window functions.",
                "## Live SQL challenge\nSolve two advanced queries against the provided datasets before time expires.",
                "Problems unlock at the start. Each problem has a score. AI assistance is disabled. Ranking uses best score per problem."),
            "dev-contest-ended": ("Review the completed SQL foundations challenge.",
                "## Past challenge\nThis event revisited sorting and aggregation from the Database course.",
                "Submissions closed at the end time. Review remains available. Ranking uses best score per problem."),
            "dev-contest-all": ("An open SQL sprint for every active student.",
                "## Campus SQL Sprint\nStudents from every course can join this short SQL event. Expect joins and subqueries.",
                "All active students are eligible. Problems unlock at the start. Submissions close at the end. Ranking uses best score per problem."),
        }
        for activity_id, title, is_contest, published, open_days, close_days, class_ids, problem_points in activities:
            options = dict(hints_enabled=not is_contest, comments_enabled=not is_contest,
                           leaderboard_enabled=is_contest, ai_allowed=not is_contest)
            short_description, description, rules = contest_copy.get(activity_id, ("", "", ""))
            upsert(db, Assignment, activity_id, dict(title=title, is_contest=is_contest,
                audience_type="all_students" if activity_id == "dev-contest-all" else "classes",
                short_description=short_description, description=description, rules=rules,
                instructions="" if is_contest else "Solve the listed SQL problems in order. Points are awarded per problem.",
                opens=current + timedelta(days=open_days), closes=current + timedelta(days=close_days),
                published=published, instructor_id=lecturer.id, **options), counts,
                "contests" if is_contest else "assignments")
            db.flush()
            db.query(AssignmentClass).filter(AssignmentClass.assignment_id == activity_id).delete(synchronize_session=False)
            db.query(AssignmentProblem).filter(AssignmentProblem.assignment_id == activity_id).delete(synchronize_session=False)
            for index, class_id in enumerate(class_ids):
                db.add(AssignmentClass(id=f"dev-ac-{activity_id}-{index}", assignment_id=activity_id, class_id=class_id))
            for index, (problem_id, points) in enumerate(problem_points):
                db.add(AssignmentProblem(id=f"dev-ap-{activity_id}-{index}", assignment_id=activity_id,
                                         problem_id=problem_id, points=points, order_index=index))
        db.flush()

        problem_by_id = {problem["id"]: problem for problem in PROBLEMS}
        submission_specs = [
            ("closed-demo-fail", students[0], "dev-where", "dev-assignment-closed", "Wrong Answer", 0, 19, "SELECT order_id, amount FROM Orders WHERE amount > 500;", None, None),
            ("closed-demo-pass", students[0], "dev-where", "dev-assignment-closed", "Accepted", 100, 18, None, None, None),
            ("closed-one-pass", students[1], "dev-order", "dev-assignment-closed", "Accepted", 100, 18, None, 88, "Correct ordering; explain tie breaks next time."),
            ("closed-two-runtime", students[2], "dev-having", "dev-assignment-closed", "Runtime Error", 0, 17, "SELECT missing_column FROM Orders;", None, None),
            ("open-one-pass", students[1], "dev-select", "dev-assignment-open", "Accepted", 100, 1, None, None, None),
            ("open-one-group", students[1], "dev-group", "dev-assignment-open", "Accepted", 100, 1, None, 92, "Good aggregate and ordering."),
            ("open-two-fail", students[2], "dev-group", "dev-assignment-open", "Wrong Answer", 0, 1, "SELECT customer_id, COUNT(*) AS order_count FROM Orders GROUP BY customer_id HAVING COUNT(*) > 10;", None, None),
            ("open-three-runtime", students[3], "dev-null", "dev-assignment-open", "Runtime Error", 0, 1, "SELECT nonexistent FROM Customers;", None, None),
            ("open-four-fail", students[4], "dev-null", "dev-assignment-open", "Wrong Answer", 0, 1, "SELECT customer_id, customer_name FROM Customers WHERE city IS NOT NULL ORDER BY customer_id;", None, None),
            ("open-four-pass", students[4], "dev-null", "dev-assignment-open", "Accepted", 100, 0.5, None, None, None),
            ("practice-demo", students[0], "dev-order", None, "Accepted", 100, 0.25, None, None, None),
            ("contest-one", students[3], "dev-cte", "dev-contest-open", "Accepted", 40, 0.01, None, None, None),
            ("contest-ended-winner-order", students[1], "dev-order", "dev-contest-ended", "Accepted", 20, 5 - 1 / 48, None, None, None),
            ("contest-ended-winner-group", students[1], "dev-group", "dev-contest-ended", "Accepted", 30, 5 - 1 / 48, None, None, None),
            ("contest-ended", students[0], "dev-order", "dev-contest-ended", "Accepted", 20, 5 - 1 / 48, None, None, None),
            ("contest-ended-runner", students[2], "dev-order", "dev-contest-ended", "Accepted", 20, 5 - 1 / 48, None, None, None),
        ]
        for slug, student, problem_id, activity_id, result, score, days_ago, query, evaluated, feedback in submission_specs:
            record_id = f"dev-sub-{slug}"
            existing = db.get(Submission, record_id)
            if existing is not None:
                if activity_id and existing.context != activity_id:
                    existing.context = activity_id
                counts["submissions"][1] += 1
                continue  # Keep manual reviews entered during browser testing.
            source = "Practice" if activity_id is None else "Contests" if activity_id.startswith("dev-contest") else "Assignments"
            db.add(Submission(id=record_id, user_id=student.id, problem_id=problem_id, source=source,
                context=activity_id if activity_id else "Practice", result=result, score=score,
                submitted_at=current - timedelta(days=days_ago), query_text=query or problem_by_id[problem_id]["solution"],
                database_type="SQL Server", evaluated_score=evaluated, feedback=feedback))
            counts["submissions"][0] += 1

        for index, (actor, action) in enumerate([
            (lecturer, "Published customer analytics lab"),
            (lecturer, "Scheduled database lab"),
            (admin, "Reviewed lecturer requests"),
            (students[1], "Completed SQL foundations assignment"),
            (students[3], "Joined live SQL challenge"),
        ]):
            upsert(db, ActivityLog, f"dev-log-{index}", dict(user_id=actor.id, action=action,
                created_at=current - timedelta(hours=index + 1)), counts, "activity_logs")

        db.commit()
        for category in ("users", "classes", "problems", "assignments", "contests", "submissions", "activity_logs"):
            created, reused = counts[category]
            print(f"{category.replace('_', ' ').title()} created/reused: {created}/{reused}")
        print("Local SQLUIT development data ready.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
