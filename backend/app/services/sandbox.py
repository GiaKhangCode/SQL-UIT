import sqlglot
from sqlglot import exp
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Problem, Submission
from typing import Dict, Any, Tuple
import datetime
import uuid

class SandboxError(Exception):
    pass

def rewrite_query(query: str) -> str:
    """ Phân tích và đổi tên các bảng thành bảng tạm (ví dụ: Customers -> #Customers) """
    try:
        parsed = sqlglot.parse_one(query, read="tsql")
    except Exception as e:
        raise SandboxError(f"Lỗi cú pháp SQL: {str(e)}")

    # Chặn các lệnh nguy hiểm (Chỉ cho phép SELECT, CTE)
    forbidden = (exp.Drop, exp.Alter, exp.Delete, exp.Update, exp.Insert, exp.Command, exp.Commit, exp.Rollback)
    for node in parsed.walk():
        if isinstance(node, forbidden):
            raise SandboxError(f"Không được phép sử dụng lệnh: {type(node).__name__.upper()}")
            
    # Tìm tất cả các bảng và thêm tiền tố #
    for table in parsed.find_all(exp.Table):
        # Tránh thêm # vào các hàm hệ thống hoặc các bảng đã có #
        if table.name and not table.name.startswith("#"):
            table.set("this", f"#{table.name}")
            
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

import concurrent.futures

def execute_query(db: Session, rewritten_query: str) -> Dict[str, Any]:
    """ Thực thi query và trả về kết quả dạng Tabular """
    def _run():
        result = db.execute(text(rewritten_query))
        columns = list(result.keys())
        rows = [list(row) for row in result.fetchall()]
        return columns, rows

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_run)
            columns, rows = future.result(timeout=5.0)

        return {
            "name": "Result",
            "columns": columns,
            "rows": rows
        }
    except concurrent.futures.TimeoutError:
        raise SandboxError("TIME_LIMIT_EXCEEDED")
    except Exception as e:
        raise SandboxError(f"Lỗi thực thi SQL: {str(e)}")

def compare_results(actual: Dict[str, Any], expected: Dict[str, Any]) -> Tuple[bool, str]:
    """ So sánh kết quả thực thi với đáp án """
    act_cols = [str(c).lower() for c in actual.get("columns", [])]
    exp_cols = [str(c).lower() for c in expected.get("columns", [])]
    
    if len(act_cols) != len(exp_cols):
        return False, f"Số lượng cột không khớp. Trả về {len(act_cols)} cột, mong đợi {len(exp_cols)} cột."
        
    if act_cols != exp_cols:
        return False, "Tên cột hoặc thứ tự cột không khớp với đáp án."
        
    act_rows = actual.get("rows", [])
    exp_rows = expected.get("rows", [])
    
    if len(act_rows) != len(exp_rows):
        return False, f"Số lượng dòng không khớp. Trả về {len(act_rows)} dòng, mong đợi {len(exp_rows)} dòng."
        
    def normalize_row(row):
        return tuple(str(x) if x is not None else "" for x in row)
        
    act_normalized = sorted([normalize_row(r) for r in act_rows])
    exp_normalized = sorted([normalize_row(r) for r in exp_rows])
    
    for i in range(len(act_normalized)):
        if act_normalized[i] != exp_normalized[i]:
            return False, "Dữ liệu không khớp sau khi đối chiếu (Sai khác ở dữ liệu hoặc tập hợp dòng)."
            
    return True, "Chính xác hoàn toàn!"

def rewrite_setup_script(script: str) -> str:
    if not script or not script.strip(): return ""
    try:
        statements = sqlglot.parse(script, read="tsql")
    except Exception as e:
        raise SandboxError(f"Lỗi cú pháp SQL trong setup: {str(e)}")

    forbidden = (exp.Drop, exp.Alter, exp.Delete, exp.Update, exp.Command, exp.Commit, exp.Rollback)
    
    rewritten_statements = []
    for parsed in statements:
        if not parsed: continue
        for node in parsed.walk():
            if isinstance(node, forbidden):
                raise SandboxError(f"Không được phép: {type(node).__name__.upper()} trong setup")
                
        for table in parsed.find_all(exp.Table):
            if table.name and not table.name.startswith("#"):
                table.set("this", f"#{table.name}")
                
        rewritten_statements.append(parsed.sql(dialect="tsql"))
        
    return ";\n".join(rewritten_statements)

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
        seed_sandbox_data_scripts(db, schema_sql, seed_data)
        rewritten_query = rewrite_query(query)
        result = execute_query(db, rewritten_query)
        return {
            "status": "Success",
            "message": "Validated successfully.",
            "table": result
        }
    except SandboxError as e:
        return {"status": "Error", "message": str(e)}
    except Exception as e:
        return {"status": "Error", "message": f"Validation failed: {str(e)}"}

def run_sandbox(db: Session, problem: Problem, query: str, is_submit: bool) -> Dict[str, Any]:
    try:
        rewritten_query = rewrite_query(query)
        
        from app.models import TestCase, TestCaseScript
        db_tcs = db.query(TestCase).filter(TestCase.problem_id == problem.id).order_by(TestCase.order_index).all()
        
        test_cases = []
        if db_tcs:
            for tc in db_tcs:
                script = db.query(TestCaseScript).filter(TestCaseScript.test_case_id == tc.id).first()
                if script:
                    tc.scripts = [script]
                    test_cases.append(tc)
                    
        if not test_cases:
            if problem.test_cases and len(problem.test_cases) > 0:
                test_cases = problem.test_cases
            elif problem.tables and problem.expected:
                test_cases = [{"tables": problem.tables, "expected": problem.expected, "is_hidden": False}]
            else:
                raise SandboxError("Bài tập chưa có dữ liệu test case.")

        if not is_submit:
            visible_cases = [tc for tc in test_cases if (tc.get('is_hidden', False) if isinstance(tc, dict) else getattr(tc, 'is_hidden', False)) == False]
            if not visible_cases:
                visible_cases = [test_cases[0]]
            test_cases_to_run = visible_cases[:1]
        else:
            test_cases_to_run = test_cases
            
        last_table = None
        
        for idx, tc in enumerate(test_cases_to_run):
            if isinstance(tc, dict):
                seed_sandbox_data(db, tc.get("tables", []))
                expected = tc.get("expected", {})
            else:
                script_obj = getattr(tc, 'scripts', None)[0] if getattr(tc, 'scripts', None) else None
                if not script_obj:
                    raise SandboxError(f"Test case {tc.id} thiếu script.")
                seed_sandbox_data_scripts(db, script_obj.create_script, script_obj.insert_script)
                
                # We need to run expected_query to get expected results
                rewritten_expected = rewrite_query(tc.expected_query)
                expected = execute_query(db, rewritten_expected)
            
            actual_result = execute_query(db, rewritten_query)
            last_table = actual_result
            
            is_correct, msg = compare_results(actual_result, expected)
            if not is_correct:
                status = "Wrong Answer" if is_submit else "Tabular result"
                msg_prefix = f"Test case {idx + 1} sai: " if len(test_cases) > 1 and is_submit else ""
                return {
                    "status": status,
                    "message": msg_prefix + msg if is_submit else "Chạy thử thành công nhưng kết quả khác đáp án.",
                    "table": actual_result
                }

        if is_submit:
            return {
                "status": "Accepted",
                "message": "Chúc mừng! Đáp án chính xác tất cả test cases.",
                "table": last_table
            }
        else:
            return {
                "status": "Tabular result",
                "message": "Chạy thử thành công.",
                "table": last_table
            }
            
    except SandboxError as e:
        if "TIME_LIMIT_EXCEEDED" in str(e):
            return {"status": "Time Limit Exceeded", "message": "Truy vấn chạy quá thời gian cho phép (5s)."}
        return {"status": "Runtime Error", "message": str(e)}
    except Exception as e:
        return {"status": "Runtime Error", "message": f"Lỗi hệ thống không xác định: {str(e)}"}
