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

def seed_sandbox_data(db: Session, problem: Problem):
    """ Tạo các bảng tạm (Local Temp Tables) và nạp dữ liệu """
    # SQL Server tự động xóa bảng tạm khi Session trả về Connection Pool 
    # (Nhờ cơ chế sp_reset_connection của ODBC)
    for table_data in problem.tables:
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

def execute_query(db: Session, rewritten_query: str) -> Dict[str, Any]:
    """ Thực thi query và trả về kết quả dạng Tabular """
    try:
        result = db.execute(text(rewritten_query))
        columns = list(result.keys())
        rows = [list(row) for row in result.fetchall()]
        return {
            "name": "Result",
            "columns": columns,
            "rows": rows
        }
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
        
    for i in range(len(act_rows)):
        act_r = [str(x) if x is not None else "" for x in act_rows[i]]
        exp_r = [str(x) if x is not None else "" for x in exp_rows[i]]
        if act_r != exp_r:
            return False, f"Dữ liệu không khớp ở dòng {i+1}."
            
    return True, "Chính xác hoàn toàn!"

def run_sandbox(db: Session, problem: Problem, query: str, is_submit: bool) -> Dict[str, Any]:
    """ Hàm chính điều phối Sandbox """
    try:
        # Bước 1: Rewrite Query
        rewritten_query = rewrite_query(query)
        
        # Bước 2: Seed dữ liệu vào Temp Tables
        seed_sandbox_data(db, problem)
        
        # Bước 3: Chạy truy vấn
        actual_result = execute_query(db, rewritten_query)
        
        # Bước 4: Chấm điểm (Nếu là Submit)
        if is_submit:
            expected_result = problem.expected
            is_correct, msg = compare_results(actual_result, expected_result)
            
            status = "Accepted" if is_correct else "Wrong Answer"
            return {
                "status": status,
                "message": msg if not is_correct else "Chúc mừng! Đáp án chính xác.",
                "table": actual_result
            }
        else:
            return {
                "status": "Tabular result",
                "message": "Chạy thử thành công.",
                "table": actual_result
            }
            
    except SandboxError as e:
        return {
            "status": "Runtime Error",
            "message": str(e)
        }
    except Exception as e:
        return {
            "status": "Runtime Error",
            "message": f"Lỗi hệ thống không xác định: {str(e)}"
        }
