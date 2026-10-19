import sqlglot
from sqlglot import exp
from sqlglot.optimizer.scope import Scope, traverse_scope
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Problem, Submission
from app.services.expected_outputs import read_expected_outputs
from typing import Dict, Any, Tuple
import datetime
import uuid
import math
import time

class SandboxError(Exception):
    pass


def _rewrite_table_as_temp(table: exp.Table) -> None:
    if not table.name or table.name.startswith("#"):
        return
    # A local temp table lives in tempdb and cannot keep the user's dbo/schema
    # qualifier. Strip catalog/schema so CREATE, INSERT, and SELECT all resolve
    # to the same session-scoped table.
    table.set("catalog", None)
    table.set("db", None)
    table.set("this", exp.to_identifier(f"#{table.name}", quoted=True))

def split_query_script(query: str) -> list[str]:
    try:
        statements = [statement for statement in sqlglot.parse(query, read="tsql") if statement is not None]
    except Exception as error:
        raise SandboxError(f"SQL syntax error: {error}") from error
    if not statements or any(not isinstance(statement, exp.Query) for statement in statements):
        raise SandboxError("Each SQL solution must be a SELECT query.")
    return [statement.sql(dialect="tsql") for statement in statements]


def rewrite_query(query: str) -> str:
    """ Phân tích và đổi tên các bảng thành bảng tạm (ví dụ: Customers -> #Customers) """
    try:
        parsed = sqlglot.parse_one(query, read="tsql")
    except Exception as e:
        raise SandboxError(f"SQL syntax error: {str(e)}")

    # Chặn các lệnh nguy hiểm (Chỉ cho phép SELECT, CTE)
    forbidden = (exp.Drop, exp.Alter, exp.Delete, exp.Update, exp.Insert, exp.Command, exp.Commit, exp.Rollback, exp.Into)
    for node in parsed.walk():
        if isinstance(node, forbidden):
            raise SandboxError(f"Statement not allowed: {type(node).__name__.upper()}")
            
    # Tìm tất cả các tables and thêm tiền tố #
    cte_refs = {id(table) for scope in traverse_scope(parsed) for table in scope.tables
                if isinstance(scope.sources.get(table.alias_or_name), Scope)}
    for table in parsed.find_all(exp.Table):
        # Tránh thêm # vào các hàm hệ thống hoặc các bảng đã có #
        if id(table) not in cte_refs:
            _rewrite_table_as_temp(table)
            
    return parsed.sql(dialect="tsql")

def infer_sql_type(sample_val: Any) -> str:
    if isinstance(sample_val, int):
        return "INT"
    elif isinstance(sample_val, float):
        return "FLOAT"
    else:
        return "VARCHAR(MAX)"

def seed_sandbox_data(db: Session, tables: list):
    """ Tạo các bảng tạm (Local Temp Tables) và nạp dữ liệu """
    # SQL Server tự động xóa bảng tạm khi Session trả về Connection Pool 
    # (Nhờ cơ chế sp_reset_connection của ODBC)
    for table_data in tables:
        name = table_data.get("name")
        cols = table_data.get("columns", [])
        rows = table_data.get("rows", [])
        
        # Tạo câu lệnh CREATE TABLE
        col_defs = []
        for i, col_name in enumerate(cols):
            sample_val = rows[0][i] if rows else ""
            col_type = infer_sql_type(sample_val)
            col_defs.append(f"[{col_name}] {col_type}")
            
        # Xóa bảng tạm cũ (nếu session connection được dùng lại)
        drop_sql = f"DROP TABLE IF EXISTS #{name}"
        db.execute(text(drop_sql))
        
        create_sql = f"CREATE TABLE #{name} ({', '.join(col_defs)})"
        db.execute(text(create_sql))
        
        # Chèn dữ liệu
        if rows:
            for r in rows:
                formatted_vals = []
                for val in r:
                    if val is None:
                        formatted_vals.append("NULL")
                    elif isinstance(val, (int, float)):
                        formatted_vals.append(str(val))
                    else:
                        safe_val = str(val).replace("'", "''")
                        formatted_vals.append(f"N'{safe_val}'")
                        
                insert_sql = f"INSERT INTO #{name} VALUES ({', '.join(formatted_vals)})"
                db.execute(text(insert_sql))

def execute_query(db: Session, rewritten_query: str, time_limit_ms: int = 5000) -> Dict[str, Any]:
    """Time execution/fetch only; enforce the driver timeout on this connection."""
    connection = db.connection().connection.driver_connection
    previous_timeout = getattr(connection, "timeout", None)
    cursor = None
    try:
        if previous_timeout is not None:
            connection.timeout = max(1, math.ceil(time_limit_ms / 1000))
        cursor = connection.cursor()
        started = time.perf_counter()
        cursor.execute(rewritten_query)
        columns = [column[0] for column in cursor.description] if cursor.description else []
        rows = [list(row) for row in cursor.fetchall()] if cursor.description else []
        elapsed_ms = (time.perf_counter() - started) * 1000
        if elapsed_ms > time_limit_ms:
            raise SandboxError("TIME_LIMIT_EXCEEDED")
        return {"name": "Result", "columns": columns, "rows": rows,
                "executionTimeMs": round(elapsed_ms, 3)}
    except SandboxError:
        raise
    except Exception as error:
        if any(marker in str(error).upper() for marker in ("HYT00", "HYT01", "TIMEOUT EXPIRED")):
            raise SandboxError("TIME_LIMIT_EXCEEDED") from error
        raise SandboxError(f"SQL execution error: {error}") from error
    finally:
        try:
            if cursor is not None:
                cursor.close()
        finally:
            if previous_timeout is not None:
                connection.timeout = previous_timeout

def compare_results(actual: Dict[str, Any], expected: Dict[str, Any]) -> Tuple[bool, str]:
    """ So sánh kết quả thực thi với đáp án """
    act_cols = [str(c).lower() for c in actual.get("columns", [])]
    exp_cols = [str(c).lower() for c in expected.get("columns", [])]
    
    if len(act_cols) != len(exp_cols):
        return False, f"Column count mismatch: returned {len(act_cols)}, expected {len(exp_cols)}."
        
    if act_cols != exp_cols:
        return False, "Column names or their order do not match the expected result."
        
    act_rows = actual.get("rows", [])
    exp_rows = expected.get("rows", [])
    
    if len(act_rows) != len(exp_rows):
        return False, f"Row count mismatch: returned {len(act_rows)}, expected {len(exp_rows)}."
        
    def normalize_row(row):
        return tuple(str(x) if x is not None else "" for x in row)
        
    act_normalized = sorted([normalize_row(r) for r in act_rows])
    exp_normalized = sorted([normalize_row(r) for r in exp_rows])
    
    for i in range(len(act_normalized)):
        if act_normalized[i] != exp_normalized[i]:
            return False, "The result values or rows do not match the expected result."
            
    return True, "Correct!"

def rewrite_setup_script(script: str) -> str:
    if not script or not script.strip(): return ""
    try:
        statements = sqlglot.parse(script, read="tsql")
    except Exception as e:
        raise SandboxError(f"Setup SQL syntax error: {str(e)}")

    forbidden = (exp.Drop, exp.Alter, exp.Delete, exp.Update, exp.Command, exp.Commit, exp.Rollback)
    
    rewritten_statements = []
    for parsed in statements:
        if not parsed: continue
        for node in parsed.walk():
            if isinstance(node, forbidden):
                raise SandboxError(f"Statement not allowed in setup: {type(node).__name__.upper()}")
                
        for table in parsed.find_all(exp.Table):
            _rewrite_table_as_temp(table)
                
        rewritten_statements.append(parsed.sql(dialect="tsql"))
        
    return ";\n".join(rewritten_statements)


def validate_seed_tables_exist(schema_sql: str, seed_data: str) -> None:
    """Fail early when a dataset inserts into tables its schema never creates."""
    try:
        schema_statements = sqlglot.parse(schema_sql or "", read="tsql")
        seed_statements = sqlglot.parse(seed_data or "", read="tsql")
    except Exception:
        # Keep syntax errors on the normal setup-script validation path.
        return

    def target_name(statement):
        target = statement.this
        if isinstance(target, exp.Schema):
            target = target.this
        if not isinstance(target, exp.Table) or not target.name:
            return None
        return target.name.lstrip("#")

    created = {
        name for statement in schema_statements
        if isinstance(statement, exp.Create) and statement.args.get("kind") == "TABLE"
        if (name := target_name(statement))
    }
    created = {name.casefold() for name in created}
    inserted = {}
    for statement in seed_statements:
        if isinstance(statement, exp.Insert) and (name := target_name(statement)):
            inserted.setdefault(name.casefold(), name)
    missing = sorted(
        (name for key, name in inserted.items() if key not in created),
        key=str.casefold,
    )
    if missing:
        names = ", ".join(name for name in missing)
        raise SandboxError(
            f"Dataset references table(s) missing from the database structure: {names}. "
            "Add matching CREATE TABLE statements or import the matching database library."
        )

def seed_sandbox_data_scripts(db: Session, schema_sql: str, seed_data: str):
    # Drop existing temp tables first if needed, but we don't know the names ahead of time here unless we parse it.
    # We assume a fresh session or that script has DROP TABLE IF EXISTS.
    # Wait, the user might not write DROP TABLE IF EXISTS. Let's rely on the connection being fresh or we can just parse table names and drop them.
    try:
        parsed_schema = sqlglot.parse(schema_sql, read="tsql")
        for stmt in parsed_schema:
            if not stmt: continue
            for table in stmt.find_all(exp.Table):
                if table.name:
                    tbl_name = table.name if table.name.startswith("#") else f"#{table.name}"
                    db.execute(text(f"DROP TABLE IF EXISTS {tbl_name}"))
    except:
        pass # Ignore drop errors

    rewritten_schema = rewrite_setup_script(schema_sql)
    rewritten_seed = rewrite_setup_script(seed_data)
    
    if rewritten_schema:
        db.execute(text(rewritten_schema))
    if rewritten_seed:
        db.execute(text(rewritten_seed))

def run_validate_sandbox(db: Session, schema_sql: str, seed_data: str, query: str) -> Dict[str, Any]:
    try:
        statements = split_query_script(query)
        if len(statements) != 1:
            raise SandboxError("Run one SELECT query per SQL solution.")
        validate_seed_tables_exist(schema_sql, seed_data)
        seed_sandbox_data_scripts(db, schema_sql, seed_data)
        rewritten_query = rewrite_query(statements[0])
        result = execute_query(db, rewritten_query, time_limit_ms=60000)
        return {
            "status": "Success",
            "message": "Validated successfully.",
            "table": result,
            "executionTimeMs": result["executionTimeMs"]
        }
    except SandboxError as e:
        return {"status": "Error", "message": str(e)}
    except Exception as e:
        return {"status": "Error", "message": f"Validation failed: {str(e)}"}

def run_sandbox(db: Session, problem: Problem, query: str, is_submit: bool, solution_id: str = None, dataset_visibility=None) -> Dict[str, Any]:
    try:
        from app.models import TestCase, TestCaseScript
        from app.services.sql_solutions import stored_solutions
        configured = stored_solutions(db, problem.id)
        enabled = [item for item in configured if item.enabled and item.query.strip()]
        if solution_id is None and len(enabled) > 1:
            if not is_submit:
                raise SandboxError("Select a SQL question to run.")
            import re
            markers = list(re.finditer(r"(?m)^-- solution:([^\r\n]+)\r?\n", query))
            answers = {match.group(1): query[match.end():markers[index + 1].start() if index + 1 < len(markers) else len(query)].strip()
                       for index, match in enumerate(markers)}
            if len(answers) != len(markers) or any(key not in {item.id for item in enabled} for key in answers):
                raise SandboxError("Invalid SQL question identifiers.")
            dataset_count = max(1, db.query(TestCase).filter(TestCase.problem_id == problem.id).count())
            results = [run_sandbox(db, problem, answers[item.id], True, item.id) if answers.get(item.id, "").strip()
                       else {"status": "Wrong Answer", "message": "No answer provided.", "passed": 0, "total": dataset_count} for item in enabled]
            for result in results:
                result.setdefault("total", dataset_count)
            total = sum(item.get("total", 1) for item in results)
            passed = sum(item.get("passed", 0) for item in results)
            return {"status": "Accepted" if passed == total else "Partial" if passed else "Wrong Answer",
                    "passed": passed, "total": total,
                    "message": " ".join(f"Question {index + 1}: {item.get('message', item['status'])}" for index, item in enumerate(results)),
                    "executionTimeMs": round(sum(item.get("executionTimeMs", 0) for item in results), 3)}
        solution = next((item for item in enabled if solution_id is None or item.id == solution_id), None)
        if solution_id and solution is None:
            raise SandboxError("Invalid or disabled SQL solution.")
        if configured and solution is None:
            raise SandboxError("No enabled SQL solution has been configured for this problem.")
        if query.startswith("-- solution:") and len(enabled) == 1 and solution_id is None:
            import re
            blocks = list(re.finditer(r"(?m)^-- solution:([^\r\n]+)\r?\n", query))
            match = next((entry for entry in blocks if entry.group(1) == solution.id), None)
            if match:
                index = blocks.index(match)
                query = query[match.end():blocks[index + 1].start() if index + 1 < len(blocks) else len(query)]
        statements = split_query_script(query)
        if len(statements) != 1:
            raise SandboxError("Enter one SELECT query for this problem.")
        student_query = rewrite_query(statements[0])
        expected_outputs, _ = read_expected_outputs(solution.expected if solution and solution.expected is not None else problem.expected if not solution or solution.id == configured[0].id else None)
        time_limit_ms = solution.time_limit_ms if solution else 5000
        test_cases = []
        for tc in db.query(TestCase).filter(TestCase.problem_id == problem.id).order_by(TestCase.order_index).all():
            script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).first()
            if script:
                tc.scripts = [script]
                test_cases.append(tc)
        if not test_cases:
            if problem.test_cases:
                test_cases = problem.test_cases
            elif problem.tables and problem.expected:
                test_cases = [{"tables": problem.tables, "expected": problem.expected, "is_hidden": False}]
            else:
                raise SandboxError("No test case data has been configured for this problem.")
        indexed_test_cases = list(enumerate(test_cases))
        if is_submit:
            cases_to_run = indexed_test_cases
        else:
            from app.services.dataset_visibility import dataset_is_hidden
            visible = [(index, tc) for index, tc in indexed_test_cases if not dataset_is_hidden(tc, index, dataset_visibility)]
            if not visible:
                raise SandboxError("No visible dataset is available for preview.")
            cases_to_run = visible[:1]
        passed = 0
        total = len(cases_to_run)
        last_table = None
        first_error = None
        elapsed_ms = 0
        for dataset_index, tc in cases_to_run:
            expected = expected_outputs[dataset_index] if dataset_index < len(expected_outputs) else None
            if isinstance(tc, dict):
                seed_sandbox_data(db, tc.get("tables", []))
                if expected is None:
                    expected = execute_query(db, rewrite_query(solution.query), time_limit_ms=60000) if solution else tc.get("expected", {})
            else:
                script = tc.scripts[0]
                seed_sandbox_data_scripts(db, script.create_script, script.insert_script)
                if expected is None:
                    expected = execute_query(db, rewrite_query(solution.query if solution else tc.expected_query), time_limit_ms=60000)
            actual = execute_query(db, student_query, time_limit_ms=time_limit_ms)
            elapsed_ms += actual["executionTimeMs"]
            last_table = actual
            correct, message = compare_results(actual, expected)
            if correct:
                passed += 1
            elif first_error is None:
                first_error = f"Dataset {dataset_index + 1}: {message}" if is_submit else "The query ran successfully, but its output differs from the expected result."
        if not is_submit:
            return {"status": "Tabular result", "message": first_error or "The query ran successfully.",
                    "table": last_table, "passed": passed, "total": total, "executionTimeMs": round(elapsed_ms, 3)}
        return {"status": "Accepted" if passed == total else "Partial" if passed else "Wrong Answer",
                "message": "Congratulations! Your solution passed all test cases." if passed == total else first_error,
                "table": last_table, "passed": passed, "total": total, "executionTimeMs": round(elapsed_ms, 3)}
    except SandboxError as error:
        if "TIME_LIMIT_EXCEEDED" in str(error):
            return {"status": "Time Limit Exceeded", "message": "The query exceeded the student time limit."}
        return {"status": "Runtime Error", "message": str(error)}
    except Exception as error:
        return {"status": "Runtime Error", "message": f"Unexpected system error: {error}"}
