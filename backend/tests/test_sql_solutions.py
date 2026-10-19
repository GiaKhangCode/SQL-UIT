import unittest
from unittest.mock import MagicMock, patch
import re

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.models import Base, User, ProblemSqlSolution
from app.schemas import ProblemCreate, SqlSolutionConfig
from app.routers.problems import create_problem, update_problem, get_problem, run_problem_workspace
from app.schemas import WorkspaceRunRequest
from app.services.sandbox import execute_query, run_validate_sandbox, run_sandbox, rewrite_query, rewrite_setup_script, split_query_script, validate_seed_tables_exist, SandboxError


class SqlSolutionPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.teacher = User(id="teacher", email="t@example.test", hashed_password="x", name="T", initials="T", role="instructor")
        self.student = User(id="student", email="s@example.test", hashed_password="x", name="S", initials="S", role="student")
        self.db.add_all([self.teacher, self.student])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def payload(self, **changes):
        data = dict(number="1", title="SQL checks", difficulty="Easy", visibility="Public", topics="",
                    statement="Query the tables", requirements="", referenceSolution="SELECT 1",
                    sqlSolutions=[dict(id="first", name="count.sql", query="SELECT COUNT(*) FROM T", enabled=True, timeLimitMs=700)])
        data.update(changes)
        return ProblemCreate(**data)

    def test_solutions_round_trip_and_are_hidden_from_students(self):
        created = create_problem(self.payload(), self.db, self.teacher)
        self.assertEqual([item.name for item in created.sql_solutions], ["count.sql"])
        self.assertEqual(created.sql_solutions[0].time_limit_ms, 700)
        student_view = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertIsNone(student_view.sql_solutions)
        self.assertEqual(student_view.reference_solution, "")
        self.assertEqual(len(student_view.sql_checks), 1)
        self.assertNotIn("query", student_view.sql_checks[0].model_dump())

        changed = update_problem(created.id, self.payload(sqlSolutions=[dict(id="first", name="renamed.sql", query="SELECT id FROM T", enabled=False, timeLimitMs=1250)]), self.db, self.teacher)
        self.assertEqual(len(changed.sql_solutions), 1)
        self.assertEqual(changed.sql_solutions[0].id, "first")
        self.assertEqual(changed.sql_solutions[0].name, "renamed.sql")
        self.assertEqual(changed.sql_solutions[0].time_limit_ms, 1250)
        self.assertFalse(changed.sql_solutions[0].enabled)
        self.assertEqual(get_problem(created.id, db=self.db, current_user=self.student).sql_checks, [])

    def test_expected_outputs_are_saved_for_grading_but_hidden_when_requested(self):
        output = {"name": "Result", "columns": ["n"], "rows": [[1]]}
        created = create_problem(self.payload(expectedOutputs=[output], expectedOutputVisible=False), self.db, self.teacher)
        teacher_view = get_problem(created.id, db=self.db, current_user=self.teacher)
        student_view = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertEqual(teacher_view.expected_outputs[0].rows, [[1]])
        self.assertFalse(teacher_view.expected_output_visible)
        self.assertIsNone(student_view.expected)
        self.assertEqual(student_view.expected_outputs, [])

    def test_saved_dataset_output_is_used_for_comparison(self):
        from app.models import Problem
        created = create_problem(self.payload(
            expectedOutputs=[{"name": "Result", "columns": ["n"], "rows": [[1]]}],
            testCases=[dict(seedData="", isHidden=False)],
        ), self.db, self.teacher)
        problem = self.db.get(Problem, created.id)
        with patch("app.services.sandbox.seed_sandbox_data_scripts"), patch(
            "app.services.sandbox.execute_query",
            return_value={"name": "Result", "columns": ["n"], "rows": [[1]], "executionTimeMs": 1},
        ) as execute:
            result = run_sandbox(self.db, problem, "SELECT 1 AS n", True)
        self.assertEqual(result["status"], "Accepted")
        self.assertEqual(execute.call_count, 1, "a saved output should replace rerunning the reference query")

    def test_hidden_datasets_hide_seed_data_and_outputs_but_keep_grading_answers(self):
        outputs = [{"name": "Result", "columns": ["n"], "rows": [[value]]} for value in (99, 2, 3)]
        cases = [dict(seedData=f"INSERT INTO T VALUES ({value})", isHidden=index == 0)
                 for index, value in enumerate((99, 2, 3))]
        created = create_problem(self.payload(schema="CREATE TABLE T (n INT)", expectedOutputs=outputs,
                                               testCases=cases), self.db, self.teacher)
        student_view = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertEqual([sample.dataset for sample in student_view.expected_samples], [2, 3])
        self.assertEqual([sample.table.rows for sample in student_view.expected_samples], [[[2]], [[3]]])
        self.assertEqual(student_view.expected.rows, [[2]])
        self.assertEqual(student_view.seed_data, "INSERT INTO T VALUES (2)")
        self.assertIn("CREATE TABLE T", student_view.schema_sql)
        self.assertNotIn("99", str(student_view.test_cases))
        teacher_view = get_problem(created.id, db=self.db, current_user=self.teacher)
        self.assertEqual(len(teacher_view.expected_outputs), 3, "Hidden answers must remain available for grading")
        self.assertTrue(teacher_view.test_cases[0]["isHidden"])

        changed = update_problem(created.id, self.payload(schema="CREATE TABLE T (n INT)", expectedOutputs=outputs,
            testCases=[dict(seedData=case["seedData"], isHidden=True) for case in cases]), self.db, self.teacher)
        hidden_view = get_problem(changed.id, db=self.db, current_user=self.student)
        self.assertEqual(hidden_view.expected_samples, [])
        self.assertIsNone(hidden_view.expected)
        self.assertEqual(hidden_view.test_cases, [])
        self.assertEqual(hidden_view.seed_data, "")

    def test_older_clients_preserve_existing_solutions(self):
        created = create_problem(self.payload(), self.db, self.teacher)
        loaded = update_problem(created.id, self.payload(sqlSolutions=None), self.db, self.teacher)
        self.assertEqual(len(loaded.sql_solutions), 1)

    def test_solution_ids_cannot_overwrite_another_problem(self):
        first = create_problem(self.payload(), self.db, self.teacher)
        second = create_problem(self.payload(number="2"), self.db, self.teacher)
        self.assertNotEqual(first.sql_solutions[0].id, second.sql_solutions[0].id)
        self.assertEqual(len(get_problem(first.id, db=self.db, current_user=self.teacher).sql_solutions), 1)

    def test_invalid_limits_and_multiple_solutions_are_rejected(self):
        for value in (0, -1, 99, 60001):
            with self.assertRaises(ValidationError):
                SqlSolutionConfig(id="a", name="a.sql", timeLimitMs=value)
        with self.assertRaises(ValidationError):
            self.payload(sqlSolutions=[dict(id="a", name="a.sql"), dict(id="a", name="b.sql")])

    def test_multiple_questions_have_independent_prompts_outputs_and_grading(self):
        from app.models import Problem
        outputs = lambda value: [{"name": "Result", "columns": ["n"], "rows": [[value]]}] * 2
        created = create_problem(self.payload(sqlSolutions=[
            dict(id="first", name="first.sql", description="First question", query="SELECT 1 AS n", timeLimitMs=700, expectedOutputs=outputs(1)),
            dict(id="second", name="second.sql", description="Second question", query="SELECT 2 AS n", timeLimitMs=900, expectedOutputs=outputs(2)),
        ], testCases=[dict(seedData="", isHidden=False), dict(seedData="secret", isHidden=True)]), self.db, self.teacher)
        view = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertEqual([item.description for item in view.sql_checks], ["First question", "Second question"])
        self.assertEqual(view.sql_checks[1].expected_samples[0].table.rows, [[2]])
        self.assertEqual(len(view.sql_checks[1].expected_samples), 1)
        self.assertNotIn("query", view.sql_checks[1].model_dump())
        problem = self.db.get(Problem, created.id)
        with patch("app.services.sandbox.seed_sandbox_data_scripts"), patch("app.services.sandbox.execute_query", side_effect=self.execute_result):
            result = run_sandbox(self.db, problem, "-- solution:first\nSELECT 1 AS n\n\n-- solution:second\nSELECT 2 AS n", True)
            self.assertEqual((result["status"], result["passed"], result["total"]), ("Accepted", 4, 4))
            result = run_sandbox(self.db, problem, "-- solution:first\nSELECT 1 AS n\n\n-- solution:second\n", True)
            self.assertEqual((result["status"], result["passed"], result["total"]), ("Partial", 2, 4))
            result = run_sandbox(self.db, problem, "SELECT 2 AS n", False, "second")
            self.assertEqual(result["passed"], 1)
            result = run_sandbox(self.db, problem, "SELECT 1 AS n", False, "foreign")
            self.assertEqual(result["status"], "Runtime Error")
        with patch("app.services.problem_workspace.run_workspace", return_value={"status": "Success"}) as run:
            run_problem_workspace(created.id, WorkspaceRunRequest(part="SQL", query="SELECT 2", solutionId="second"), self.db, self.student)
            self.assertEqual(run.call_args.kwargs["sql_time_limits"], [900])
        payload = self.payload(sqlSolutions=[dict(id="second", name="renamed.sql", description="Second updated", query="SELECT 2 AS n", expectedOutputs=outputs(2), expectedOutputVisible=False)])
        update_problem(created.id, payload, self.db, self.teacher)
        view = get_problem(created.id, db=self.db, current_user=self.student)
        self.assertEqual(len(view.sql_checks), 1)
        self.assertEqual(view.sql_checks[0].expected_samples, [])
        self.assertEqual(view.sql_checks[0].description, "Second updated")

    def grading_problem(self):
        return create_problem(self.payload(sqlSolutions=[
            dict(id="first", name="first.sql", query="SELECT 1 AS n", timeLimitMs=700),
        ], testCases=[dict(seedData="", isHidden=False), dict(seedData="", isHidden=True)]), self.db, self.teacher)

    @staticmethod
    def execute_result(db, query, time_limit_ms=5000):
        value = int(re.search(r"SELECT\s+(\d+)", query, re.I).group(1))
        return {"columns": ["n"], "rows": [[value]], "executionTimeMs": 10}

    def test_query_must_pass_every_dataset(self):
        from app.models import Problem
        created = self.grading_problem()
        problem = self.db.get(Problem, created.id)
        with patch("app.services.sandbox.seed_sandbox_data_scripts"), patch("app.services.sandbox.execute_query", side_effect=self.execute_result) as execute:
            result = run_sandbox(self.db, problem, "SELECT 1 AS n", True)
        self.assertEqual(result["status"], "Accepted")
        self.assertEqual((result["passed"], result["total"]), (2, 2))
        self.assertEqual([call.kwargs["time_limit_ms"] for call in execute.call_args_list if call.kwargs["time_limit_ms"] != 60000], [700, 700])
        outputs = [{"columns": ["n"], "rows": [[value]], "executionTimeMs": 10} for value in (1, 1, 1, 9)]
        with patch("app.services.sandbox.seed_sandbox_data_scripts"), patch("app.services.sandbox.execute_query", side_effect=outputs):
            result = run_sandbox(self.db, problem, "SELECT 1 AS n", True)
        self.assertNotEqual(result["status"], "Accepted")
        self.assertEqual((result["passed"], result["total"]), (1, 2))
        result = run_sandbox(self.db, problem, "SELECT 1; SELECT 2", True)
        self.assertEqual(result["status"], "Runtime Error")
        self.assertIn("one SELECT query", result["message"])

    def test_workspace_receives_per_check_student_limits(self):
        created = self.grading_problem()
        with patch("app.services.problem_workspace.run_workspace", return_value={"status": "Success"}) as run:
            run_problem_workspace(created.id, WorkspaceRunRequest(part="SQL", query="SELECT 1"), self.db, self.student)
        self.assertEqual(run.call_args.kwargs["sql_time_limits"], [700])


class SqlSolutionTimingTests(unittest.TestCase):
    def test_query_script_and_cte_rewriting(self):
        self.assertEqual(len(split_query_script("SELECT 1; SELECT 2;")), 2)
        rewritten = rewrite_query("WITH A AS (SELECT * FROM T) SELECT * FROM A")
        self.assertIn("#T", rewritten)
        self.assertNotIn("#A", rewritten)
        with self.assertRaises(SandboxError):
            split_query_script("SELECT 1; DELETE FROM T")
        with self.assertRaises(SandboxError):
            rewrite_query("SELECT * INTO NewTable FROM T")

    def test_qualified_setup_tables_are_rewritten_to_the_same_temp_name(self):
        schema = rewrite_setup_script("""
            CREATE TABLE dbo.Authors (AuthorId INT PRIMARY KEY);
            CREATE TABLE dbo.Books (BookId INT PRIMARY KEY, AuthorId INT,
                CONSTRAINT FK_Books_Authors FOREIGN KEY (AuthorId) REFERENCES dbo.Authors(AuthorId));
        """)
        seed = rewrite_setup_script("INSERT INTO Authors (AuthorId) VALUES (1);")
        self.assertIn("CREATE TABLE [#Authors]", schema)
        self.assertIn("REFERENCES [#Authors]", schema)
        self.assertNotIn("dbo", schema.lower())
        self.assertIn("INSERT INTO [#Authors]", seed)

    def test_dataset_reports_tables_missing_from_database_structure(self):
        with self.assertRaisesRegex(SandboxError, "Authors, Books"):
            validate_seed_tables_exist(
                "CREATE TABLE dbo.Customers (CustomerId INT);",
                "INSERT INTO Authors VALUES (1); INSERT INTO Books VALUES (2);",
            )

    def connection(self):
        connection = MagicMock()
        connection.timeout = 9
        cursor = connection.cursor.return_value
        cursor.description = [("id",)]
        cursor.fetchall.return_value = [(1,)]
        db = MagicMock()
        db.connection.return_value.connection.driver_connection = connection
        return db, connection, cursor

    def test_timer_and_driver_timeout_are_restored(self):
        db, connection, cursor = self.connection()
        with patch("app.services.sandbox.time.perf_counter", side_effect=[10, 10.0125]):
            table = execute_query(db, "SELECT 1", time_limit_ms=700)
        self.assertEqual(table["rows"], [[1]])
        self.assertAlmostEqual(table["executionTimeMs"], 12.5)
        self.assertEqual(connection.timeout, 9)
        cursor.close.assert_called_once()

    def test_fractional_second_limit_is_enforced(self):
        db, connection, cursor = self.connection()
        with patch("app.services.sandbox.time.perf_counter", side_effect=[10, 10.8]):
            with self.assertRaisesRegex(SandboxError, "TIME_LIMIT_EXCEEDED"):
                execute_query(db, "SELECT 1", time_limit_ms=700)
        self.assertEqual(connection.timeout, 9)
        cursor.close.assert_called_once()

    def test_driver_timeout_is_a_time_limit_error_and_cursor_is_closed(self):
        db, connection, cursor = self.connection()
        cursor.execute.side_effect = RuntimeError("HYT00 timeout expired")
        with self.assertRaisesRegex(SandboxError, "TIME_LIMIT_EXCEEDED"):
            execute_query(db, "SELECT 1", time_limit_ms=700)
        self.assertEqual(connection.timeout, 9)
        cursor.close.assert_called_once()

    def test_teacher_run_returns_query_time_instead_of_setup_time(self):
        with patch("app.services.sandbox.seed_sandbox_data_scripts"), patch("app.services.sandbox.rewrite_query", return_value="SELECT 1"), patch("app.services.sandbox.execute_query", return_value={"columns": ["id"], "rows": [[1]], "executionTimeMs": 3.25}):
            result = run_validate_sandbox(MagicMock(), "schema", "seed", "SELECT 1")
        self.assertEqual(result["executionTimeMs"], 3.25)


if __name__ == "__main__":
    unittest.main()
