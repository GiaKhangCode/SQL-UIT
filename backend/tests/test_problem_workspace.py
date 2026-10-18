import itertools
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas import ProblemCreate, WorkspaceRunRequest, QueryRequest
from app.models import Base, User
from app.routers.problems import create_problem, get_problem, update_problem, run_problem_workspace, submit_query
from app.services.problem_workspace import SandboxError, execution_plan, rewrite_stage, run_workspace, read_workspace_schema

SCHEMA = "w_" + "a" * 32


class ProblemWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.teacher = User(id="teacher", email="t@example.test", hashed_password="x", name="Teacher", initials="T", role="instructor")
        self.student = User(id="student", email="s@example.test", hashed_password="x", name="Student", initials="S", role="student")
        self.db.add_all([self.teacher, self.student]); self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def payload(self, parts=None):
        data = dict(number="1", title="Practice", difficulty="Easy", visibility="Public", topics="SELECT", statement="Solve", requirements="", schema="CREATE TABLE T (id INT)", referenceSolution="SELECT * FROM T", testCases=[{"seedData": "INSERT INTO T VALUES (1)", "isHidden": False}])
        if parts is not None:
            data["workspaceParts"] = parts
        return ProblemCreate(**data)

    def test_all_seven_combinations_persist_and_can_be_edited(self):
        for size in (1, 2, 3):
            for parts in itertools.combinations(["DDL", "DML", "SQL"], size):
                created = create_problem(self.payload(list(parts)), self.db, self.teacher)
                loaded = get_problem(created.id, db=self.db, current_user=self.teacher)
                self.assertEqual(loaded.workspace_parts, list(parts))
                changed = update_problem(created.id, self.payload(["SQL"]), self.db, self.teacher)
                self.assertEqual(changed.workspace_parts, ["SQL"])

    def test_legacy_default_empty_and_unknown_parts(self):
        self.assertEqual(self.payload().workspace_parts, ["SQL"])
        for value in ([], ["OTHER"]):
            with self.assertRaises(ValidationError): self.payload(value)
        self.assertEqual(self.payload(["SQL", "DDL", "SQL"]).workspace_parts, ["DDL", "SQL"])

    def test_ddl_reference_is_not_returned_to_student(self):
        created = create_problem(self.payload(["DDL", "DML"]), self.db, self.teacher)
        teacher = get_problem(created.id, db=self.db, current_user=self.teacher)
        student = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertIn("CREATE TABLE", teacher.schema_sql)
        self.assertEqual(student.schema_sql, "")
        self.assertTrue(all(case["schema"] == "" for case in student.test_cases))

    def test_reference_database_filename_is_saved_and_editable(self):
        payload = self.payload(["DDL"])
        payload.schema_file_name = "thuviensach.sql"
        created = create_problem(payload, self.db, self.teacher)
        self.assertEqual(get_problem(created.id, db=self.db, current_user=self.teacher).schema_file_name, "thuviensach.sql")

        updated_payload = self.payload(["DDL"])
        updated_payload.schema_file_name = "library_v2.sql"
        updated = update_problem(created.id, updated_payload, self.db, self.teacher)
        self.assertEqual(updated.schema_file_name, "library_v2.sql")

    def test_disabled_parts_and_unauthorized_access_do_not_execute(self):
        created = create_problem(self.payload(["SQL"]), self.db, self.teacher)
        with patch("app.services.problem_workspace.run_workspace") as runner:
            with self.assertRaises(HTTPException) as raised:
                run_problem_workspace(created.id, WorkspaceRunRequest(part="DML", dml="DELETE FROM T"), self.db, self.student)
            self.assertEqual(raised.exception.status_code, 400)
            runner.assert_not_called()

    def test_mixed_problem_cannot_receive_a_false_sql_only_grade(self):
        created = create_problem(self.payload(["DDL", "SQL"]), self.db, self.teacher)
        with patch("app.routers.problems.run_sandbox") as grader:
            with self.assertRaises(HTTPException) as raised:
                submit_query(created.id, QueryRequest(query="SELECT * FROM T"), self.db, self.student)
            self.assertEqual(raised.exception.status_code, 400)
            grader.assert_not_called()

    def test_plan_uses_selected_parts_and_same_schema(self):
        request = WorkspaceRunRequest(part="SQL", ddl="CREATE TABLE T (id INT)", dml="INSERT INTO T VALUES (2); UPDATE T SET id=3", query="SELECT * FROM T")
        plan = execution_plan(["DDL", "DML", "SQL"], request, "CREATE TABLE Wrong (id INT)", "", SCHEMA)
        self.assertEqual(len(plan), 4)
        self.assertTrue(all(SCHEMA in statement for statement in plan))
        self.assertNotIn("Wrong", " ".join(plan))
        plan = execution_plan(["SQL"], request, "CREATE TABLE Given (id INT)", "", SCHEMA)
        self.assertIn("Given", plan[0]); self.assertEqual(len(plan), 2)
        request.ddl = ""
        with self.assertRaises(SandboxError): execution_plan(["DDL", "SQL"], request, "", "", SCHEMA)

    def test_rewriter_accepts_ddl_dml_ctes_and_blocks_cross_schema(self):
        self.assertEqual(len(rewrite_stage("CREATE TABLE T(id INT); ALTER TABLE T ADD name NVARCHAR(50)", "DDL", SCHEMA)), 2)
        self.assertEqual(len(rewrite_stage("INSERT INTO T VALUES(1); UPDATE T SET id=2; DELETE FROM T WHERE id=3", "DML", SCHEMA)), 3)
        query = rewrite_stage("WITH A AS (SELECT * FROM T) SELECT * FROM A", "SQL", SCHEMA)[0]
        self.assertIn(f"[{SCHEMA}].T", query)
        self.assertNotIn(f"[{SCHEMA}].A", query)
        nested = rewrite_stage("SELECT * FROM Users WHERE EXISTS (WITH Users AS (SELECT * FROM T) SELECT * FROM Users)", "SQL", SCHEMA)[0]
        self.assertIn(f"FROM [{SCHEMA}].Users", nested)
        for part, script in [("SQL", "SELECT * FROM dbo.users"), ("SQL", "SELECT * INTO T FROM Users"), ("SQL", "SELECT 1; DELETE FROM T"), ("DML", "EXEC sp_executesql N'DELETE FROM users'"), ("DDL", "DROP DATABASE SQLUIT"), ("DDL", "CREATE VIEW T AS SELECT 1"), ("DML", "UPDATE dbo.users SET name='x'")]:
            with self.subTest(script=script), self.assertRaises(SandboxError): rewrite_stage(script, part, SCHEMA)

    def test_executed_schema_includes_types_primary_keys_and_foreign_keys(self):
        cursor = MagicMock()
        cursor.fetchall.side_effect = [
            [("Customers", "id", "int", "NO", None, 10, 0),
             ("Orders", "customerId", "int", "NO", None, 10, 0),
             ("Orders", "label", "nvarchar", "YES", -1, None, None)],
            [("Customers", "id")],
            [("Orders", "customerId", "Customers", "id", "FK_Customer")],
        ]
        tables, columns = read_workspace_schema(cursor, SCHEMA)
        self.assertEqual(tables[0]["primaryKeys"], ["id"])
        self.assertEqual(tables[1]["columns"][1]["type"], "nvarchar(MAX)")
        self.assertEqual(tables[1]["foreignKeys"], [{"columns": ["customerId"], "referencedTable": "Customers", "referencedColumns": ["id"]}])
        self.assertEqual(columns[0], ["Customers", "id", "int", "NO"])
        self.assertTrue(all(call.args[1] == SCHEMA for call in cursor.execute.call_args_list))

    def test_ddl_returns_measured_time_and_executed_schema(self):
        engine = MagicMock(); engine.dialect.name = "mssql"
        connection = engine.connect.return_value.__enter__.return_value
        connection.connection.driver_connection.timeout = None
        cursor = connection.connection.cursor.return_value
        cursor.description = None
        cursor.nextset.return_value = False
        schema_tables = [{"name": "T", "columns": [{"name": "id", "type": "int", "constraints": "NOT NULL"}], "primaryKeys": ["id"], "foreignKeys": [], "constraints": []}]
        request = WorkspaceRunRequest(part="DDL", ddl="CREATE TABLE T(id INT PRIMARY KEY)")
        with patch("app.services.problem_workspace.read_workspace_schema", return_value=(schema_tables, [["T", "id", "int", "NO"]])), patch("app.services.problem_workspace.time.perf_counter", side_effect=[10, 10.012]):
            result = run_workspace(engine, ["DDL"], request, "", "")
        self.assertEqual(result["status"], "Success")
        self.assertEqual(result["executionTimeMs"], 12)
        self.assertEqual(result["schemaTables"], schema_tables)
        connection.begin.return_value.rollback.assert_called_once()

    def test_dml_timing_excludes_ddl_and_instructor_seed(self):
        engine = MagicMock(); engine.dialect.name = "mssql"
        connection = engine.connect.return_value.__enter__.return_value
        connection.connection.driver_connection.timeout = None
        cursor = connection.connection.cursor.return_value
        cursor.description = None
        cursor.nextset.return_value = False
        request = WorkspaceRunRequest(part="DML", ddl="CREATE TABLE T(id INT)", dml="INSERT INTO T VALUES (2)")
        with patch("app.services.problem_workspace.read_workspace_schema", return_value=([], [])), patch("app.services.problem_workspace.time.perf_counter", side_effect=[0, .02, 1, 1.03, 2, 2.004]):
            result = run_workspace(engine, ["DDL", "DML"], request, "", "INSERT INTO T VALUES (1)")
        self.assertEqual(result["status"], "Success")
        self.assertEqual(result["executionTimeMs"], 4)
        self.assertEqual(result["schemaTables"], [])
        connection.begin.return_value.rollback.assert_called_once()

    def test_failure_rolls_back_workspace(self):
        engine = MagicMock(); engine.dialect.name = "mssql"
        connection = engine.connect.return_value.__enter__.return_value
        transaction = connection.begin.return_value
        cursor = connection.connection.cursor.return_value
        cursor.execute.side_effect = RuntimeError("SQL failed")
        result = run_workspace(engine, ["DDL"], WorkspaceRunRequest(part="DDL", ddl="CREATE TABLE T(id INT)"), "", "")
        self.assertEqual(result["status"], "Error")
        transaction.rollback.assert_called_once(); cursor.close.assert_called_once()


if __name__ == "__main__": unittest.main()
