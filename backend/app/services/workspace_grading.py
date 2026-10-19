"""Automatic grading for the DDL, DML and SQL workspace sections."""
import math

from app.models import TestCase, TestCaseScript
from app.schemas import WorkspaceRunRequest
from app.services.expected_outputs import read_expected_outputs
from app.services.problem_workspace import run_workspace
from app.services.sandbox import compare_results, run_sandbox
from app.services.sql_solutions import stored_solutions


def _problem_cases(db, problem):
    rows = db.query(TestCase).filter(TestCase.problem_id == problem.id).order_by(TestCase.order_index).all()
    cases = []
    for index, row in enumerate(rows):
        script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == row.id).first()
        if script:
            cases.append({
                "index": index,
                "hidden": bool(row.is_hidden),
                "schema": script.create_script or "",
                "seed": script.insert_script or "",
                "query": row.expected_query or "",
            })
    return cases


def _reference_query(db, problem, cases):
    solutions = stored_solutions(db, problem.id)
    if solutions:
        solution = next((row for row in solutions if row.enabled and row.query.strip()), None)
        return solution.query if solution else ""
    return next((case["query"] for case in cases if case["query"].strip()), "")


def _schema_signature(tables):
    return tuple(sorted((
        str(table.get("name", "")).casefold(),
        tuple((str(column.get("name", "")).casefold(), str(column.get("type", "")).casefold(),
               str(column.get("constraints", "")).casefold()) for column in table.get("columns", [])),
        tuple(str(column).casefold() for column in table.get("primaryKeys", [])),
        tuple(sorted((
            tuple(str(column).casefold() for column in key.get("columns", [])),
            str(key.get("referencedTable", "")).casefold(),
            tuple(str(column).casefold() for column in key.get("referencedColumns", [])),
        ) for key in table.get("foreignKeys", []))),
    ) for table in tables))


def _table_state(tables):
    state = {}
    for table in tables or []:
        name = str(table.get("name", "")).casefold()
        columns = tuple(str(column).casefold() for column in table.get("columns", []))
        rows = tuple(sorted(tuple("<NULL>" if value is None else str(value) for value in row)
                            for row in table.get("rows", [])))
        state[name] = (columns, rows)
    return state


def _workspace_run(engine, parts, *, part, ddl="", dml="", query="", schema_sql="",
                   seed_sql="", row_limit=10000, query_time_limit=None):
    request = WorkspaceRunRequest(part=part, ddl=ddl, dml=dml, query=query)
    return run_workspace(engine, parts, request, schema_sql, seed_sql,
                         sql_time_limits=[query_time_limit] if query_time_limit else None,
                         table_row_limit=row_limit, strict_table_row_limit=True,
                         query_row_limit=10000, strict_query_row_limit=True)


def _grade_ddl(db, engine, problem, scripts, cases):
    if not scripts.get("ddl", "").strip():
        return 0.0, "Enter your CREATE TABLE statements.", False
    reference_schema = next((case["schema"] for case in cases if case["schema"].strip()), "")
    if not reference_schema:
        return 0.0, "The instructor has not configured a reference database structure.", True

    actual = _workspace_run(engine, ["DDL"], part="DDL", ddl=scripts["ddl"])
    expected = _workspace_run(engine, ["DDL"], part="DDL", ddl=reference_schema)
    if actual.get("status") != "Success":
        return 0.0, f"Your DDL could not be executed: {actual.get('message', 'unknown error')}", True
    if expected.get("status") != "Success":
        return 0.0, f"The instructor reference schema could not be run: {expected.get('message', 'unknown error')}", True
    if _schema_signature(actual.get("schemaTables", [])) != _schema_signature(expected.get("schemaTables", [])):
        return 0.0, "Your tables, columns, types, nullability, or keys do not match the reference schema.", False

    # Replay every instructor dataset and solution query on the student's real
    # schema, so matching metadata alone cannot hide a schema that does not work.
    query = _reference_query(db, problem, cases)
    outputs, _ = read_expected_outputs(problem.expected)
    if query:
        for case in cases:
            seed = case["seed"]
            case_schema = case["schema"] or reference_schema
            actual_result = _workspace_run(engine, ["DDL", "SQL"], part="SQL",
                ddl=scripts["ddl"], query=query, schema_sql=case_schema, seed_sql=seed,
                query_time_limit=60000)
            if actual_result.get("status") != "Success":
                return 0.0, f"Your schema failed on dataset {case['index'] + 1}: {actual_result.get('message', 'unknown error')}", True
            expected_table = outputs[case["index"]] if case["index"] < len(outputs) else None
            if expected_table is None:
                reference_result = _workspace_run(engine, ["SQL"], part="SQL", query=query,
                    schema_sql=case_schema, seed_sql=seed, query_time_limit=60000)
                if reference_result.get("status") != "Success":
                    return 0.0, f"The instructor reference failed on dataset {case['index'] + 1}: {reference_result.get('message', 'unknown error')}", True
                expected_table = reference_result["table"]
            correct, _ = compare_results(actual_result.get("table") or {}, expected_table)
            if not correct:
                return 0.0, f"The instructor query returned different results on dataset {case['index'] + 1} with your schema.", False
    return 1.0, "Schema matches the reference and accepts the instructor datasets.", False


def _grade_dml(db, engine, problem, scripts, parts, cases):
    target = next((case for case in cases if not case["hidden"]), None)
    if target is None:
        return 0.0, "The instructor has not configured a visible target dataset.", True
    if not scripts.get("dml", "").strip():
        return 0.0, "Enter INSERT statements for the target dataset.", False
    schema = target["schema"]
    actual = _workspace_run(engine, parts, part="DML", ddl=scripts.get("ddl", ""),
                            dml=scripts["dml"], schema_sql=schema, seed_sql=target["seed"])
    if actual.get("status") != "Success":
        return 0.0, f"Your INSERT statements could not be executed: {actual.get('message', 'unknown error')}", True
    expected = _workspace_run(engine, ["DDL", "DML"], part="DML", ddl=schema,
                              dml=target["seed"], row_limit=10000)
    if expected.get("status") != "Success":
        return 0.0, f"The instructor target dataset could not be loaded: {expected.get('message', 'unknown error')}", True
    if _table_state(actual.get("tables")) != _table_state(expected.get("tables")):
        return 0.0, "The rows in your tables do not match the visible target dataset.", False

    query = _reference_query(db, problem, cases)
    if query:
        output_index = target["index"]
        outputs, _ = read_expected_outputs(problem.expected)
        validation_parts = list(dict.fromkeys([*parts, "SQL"]))
        actual_result = _workspace_run(engine, validation_parts, part="SQL",
            ddl=scripts.get("ddl", ""), dml=scripts["dml"], query=query,
            schema_sql=schema, query_time_limit=60000)
        if actual_result.get("status") != "Success":
            return 0.0, f"The instructor query could not run on your data: {actual_result.get('message', 'unknown error')}", True
        expected_table = outputs[output_index] if output_index < len(outputs) else None
        if expected_table is None:
            reference_result = _workspace_run(engine, ["SQL"], part="SQL", query=query,
                schema_sql=schema, seed_sql=target["seed"], query_time_limit=60000)
            if reference_result.get("status") != "Success":
                return 0.0, f"The instructor query could not run on the target dataset: {reference_result.get('message', 'unknown error')}", True
            expected_table = reference_result["table"]
        correct, _ = compare_results(actual_result.get("table") or {}, expected_table)
        if not correct:
            return 0.0, "The instructor query returned different results on your data.", False
    return 1.0, "Your inserted rows match the target dataset.", False


def grade_workspace_submission(db, problem, scripts, parts, maximum=100):
    """Grade each selected stage against the instructor's canonical problem data."""
    engine = db.get_bind()
    cases = _problem_cases(db, problem)
    if not cases:
        return {"status": "Runtime Error", "score": 0, "feedback": "No instructor datasets are configured."}
    ratios = []
    notes = []
    has_runtime_error = False

    if "DDL" in parts:
        ratio, note, failed_setup = _grade_ddl(db, engine, problem, scripts, cases)
        ratios.append(ratio); notes.append(f"DDL: {note}"); has_runtime_error |= failed_setup

    if "DML" in parts:
        ratio, note, failed_setup = _grade_dml(db, engine, problem, scripts, parts, cases)
        ratios.append(ratio); notes.append(f"DML: {note}"); has_runtime_error |= failed_setup

    if "SQL" in parts:
        result = run_sandbox(db, problem, scripts.get("query", ""), is_submit=True)
        status = result.get("status", "Runtime Error")
        total = max(1, result.get("total", 1))
        ratio = result.get("passed", 0) / total
        ratios.append(ratio)
        notes.append(f"SQL: {result.get('message') or status}")
        has_runtime_error |= status in {"Runtime Error", "Time Limit Exceeded"}

    total_ratio = sum(ratios) / max(len(ratios), 1)
    score = min(maximum, max(0, math.floor(maximum * total_ratio + 0.5)))
    status = "Accepted" if total_ratio >= 1 else "Partial" if score > 0 else "Wrong Answer"
    if has_runtime_error and score == 0:
        status = "Runtime Error"
    notes.append(f"Score: {score}/{maximum}.")
    return {"status": status, "score": score, "feedback": " ".join(notes)}
