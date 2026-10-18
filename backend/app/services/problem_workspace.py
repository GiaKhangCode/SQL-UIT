"""Replay staged work in one transaction and roll it back after returning results.

Every request gets a random schema. DDL, initial data, DML and SELECT execute on
one connection in that order. No student SQL touches application tables.
This runner is for trying a problem, not for grading or durable exam schemas.
"""
import re
import uuid
import math
import time
import sqlglot
from sqlglot import exp
from sqlglot.optimizer.scope import Scope, traverse_scope

class SandboxError(ValueError):
    pass


def rewrite_stage(script: str, part: str, schema: str) -> list[str]:
    if not re.fullmatch(r"w_[0-9a-f]{32}", schema):
        raise SandboxError("Invalid workspace schema.")
    script = re.sub(r"(?im)^\s*GO\s*$", ";", script or "")
    try:
        statements = sqlglot.parse(script, read="tsql")
    except Exception as error:
        raise SandboxError(f"{part} syntax error: {error}") from error
    output = []
    for statement in statements:
        if statement is None:
            continue
        valid = ((part == "DDL" and isinstance(statement, (exp.Create, exp.Alter, exp.Drop))
                  and str(statement.args.get("kind", "")).upper() == "TABLE")
                 or (part == "DML" and isinstance(statement, (exp.Insert, exp.Update, exp.Delete)))
                 or (part == "SQL" and isinstance(statement, exp.Query)))
        if not valid:
            raise SandboxError(f"This statement is not supported in the {part} section.")
        blocked = (exp.Command, exp.Grant, exp.Revoke, exp.Transaction, exp.Commit, exp.Rollback, exp.Into)
        if any(isinstance(node, blocked) for node in statement.walk()):
            raise SandboxError("This statement is not allowed in the workspace.")
        # No writes nested inside a SELECT/CTE, no SELECT INTO.
        if part == "SQL" and any(isinstance(node, (exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Alter, exp.Drop)) for node in statement.walk()):
            raise SandboxError("The SQL section only supports data queries.")
        cte_refs = {
            id(table)
            for scope in traverse_scope(statement)
            for table in scope.tables
            if isinstance(scope.sources.get(table.alias_or_name), Scope)
        }

        for table in statement.find_all(exp.Table):
            if table.db or table.catalog or not isinstance(table.this, exp.Identifier):
                raise SandboxError("Use problem table names only. Database/schema qualifiers and external data sources are not allowed.")
            if table.name.startswith(("#", "@")):
                raise SandboxError("Use regular table names in the workspace.")
            if id(table) not in cte_refs:
                table.set("db", exp.to_identifier(schema, quoted=True))
        # Prevent qualified function calls that can target an external schema/server.
        if any(isinstance(node, exp.Dot) and isinstance(node.expression, exp.Func) for node in statement.walk()):
            raise SandboxError("Function calls to other schemas are not supported.")
        output.append(statement.sql(dialect="tsql"))
    return output


def execution_plan(enabled, request, schema_sql, seed_sql, schema):
    if request.part not in enabled:
        raise SandboxError("This section is not enabled for this problem.")
    ddl = request.ddl if "DDL" in enabled else schema_sql
    if "DDL" in enabled and request.part != "DDL" and not ddl.strip():
        raise SandboxError("Complete the table structure in the DDL section first.")
    plan = rewrite_stage(ddl, "DDL", schema)
    if request.part != "DDL":
        plan += rewrite_stage(seed_sql, "DML", schema)
        if "DML" in enabled:
            plan += rewrite_stage(request.dml, "DML", schema)
        if request.part == "SQL":
            if not request.query.strip():
                raise SandboxError("Enter a SQL query.")
            plan += rewrite_stage(request.query, "SQL", schema)
    return plan


def read_workspace_schema(cursor, schema):
    """Read the executed schema, including ALTER changes and key relationships."""
    cursor.execute("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION", schema)
    columns = [list(row) for row in cursor.fetchall()]
    tables = {}
    for name, column, data_type, nullable, length, precision, scale in columns:
        formatted_type = data_type
        if length is not None:
            formatted_type += f"({'MAX' if length == -1 else length})"
        elif data_type in ("decimal", "numeric") and precision is not None:
            formatted_type += f"({precision},{scale or 0})"
        table = tables.setdefault(name, {"name": name, "columns": [], "constraints": [], "primaryKeys": [], "foreignKeys": []})
        table["columns"].append({"name": column, "type": formatted_type, "constraints": "NOT NULL" if nullable == "NO" else "NULL"})
    cursor.execute("SELECT k.TABLE_NAME, k.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON t.CONSTRAINT_CATALOG = k.CONSTRAINT_CATALOG AND t.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME = k.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA = ? AND t.CONSTRAINT_TYPE = 'PRIMARY KEY' ORDER BY k.TABLE_NAME, k.ORDINAL_POSITION", schema)
    for name, column in cursor.fetchall():
        if name in tables:
            tables[name]["primaryKeys"].append(column)
    cursor.execute("SELECT t.name, c.name, rt.name, rc.name, fk.name FROM sys.foreign_key_columns fkc JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id JOIN sys.tables t ON t.object_id = fkc.parent_object_id JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = fkc.parent_column_id JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id WHERE SCHEMA_NAME(t.schema_id) = ? ORDER BY t.name, fk.name, fkc.constraint_column_id", schema)
    relationships = {}
    for name, column, target, target_column, constraint in cursor.fetchall():
        if name not in tables:
            continue
        key = (name, constraint)
        if key not in relationships:
            relationships[key] = {"columns": [], "referencedTable": target, "referencedColumns": []}
            tables[name]["foreignKeys"].append(relationships[key])
        relationships[key]["columns"].append(column)
        relationships[key]["referencedColumns"].append(target_column)
    return list(tables.values()), [row[:4] for row in columns]


def run_workspace(engine, enabled, request, schema_sql, seed_sql, sql_time_limits=None):
    schema = "w_" + uuid.uuid4().hex
    execution_ms = 0
    try:
        plan = execution_plan(enabled, request, schema_sql, seed_sql, schema)
        query_count = len(rewrite_stage(request.query, "SQL", schema)) if request.part == "SQL" else 0
        if request.part == "SQL" and sql_time_limits is not None and query_count != len(sql_time_limits):
            raise SandboxError("Enter one SELECT query for this problem.")
        query_start = len(plan) - query_count
        stage_start = 0
        if request.part == "DML":
            stage_start = len(plan) - len(rewrite_stage(request.dml, "DML", schema))
        elif request.part == "SQL":
            stage_start = query_start
        if engine.dialect.name != "mssql":
            raise SandboxError("Workspace execution requires SQL Server.")
        with engine.connect() as conn:
            transaction = conn.begin()
            cursor = None
            driver = conn.connection.driver_connection
            previous_timeout = getattr(driver, "timeout", None)
            try:
                if previous_timeout is not None:
                    driver.timeout = 15
                cursor = conn.connection.cursor()
                cursor.execute(f"CREATE SCHEMA [{schema}]")
                table = None
                execution_ms = 0
                for index, statement in enumerate(plan):
                    limit = (sql_time_limits[index - query_start] if sql_time_limits is not None else 5000) if index >= query_start and query_count else 15000
                    if previous_timeout is not None:
                        driver.timeout = max(1, math.ceil(limit / 1000))
                        cursor.close()
                        cursor = conn.connection.cursor()
                    started = time.perf_counter()
                    try:
                        cursor.execute(statement)
                        while True:
                            if cursor.description:
                                columns = [column[0] for column in cursor.description]
                                table = {"name": "Result", "columns": columns, "rows": [list(row) for row in cursor.fetchmany(1000)]}
                            if not cursor.nextset():
                                break
                    finally:
                        elapsed_ms = (time.perf_counter() - started) * 1000
                        if index >= stage_start:
                            execution_ms += elapsed_ms
                    if index >= query_start and query_count and elapsed_ms > limit:
                        raise SandboxError("The SQL query exceeded the student time limit.")
                schema_tables, columns = read_workspace_schema(cursor, schema)
                tables = []
                if request.part == "DDL":
                    tables = [{"name": "Table structure", "columns": ["Table", "Column", "Data type", "Nullable"], "rows": columns}]
                elif request.part == "DML":
                    for name in dict.fromkeys(row[0] for row in columns):
                        quoted = name.replace("]", "]]")
                        cursor.execute(f"SELECT TOP (100) * FROM [{schema}].[{quoted}]")
                        tables.append({"name": name, "columns": [c[0] for c in cursor.description], "rows": [list(row) for row in cursor.fetchall()]})
                return {"status": "Success", "message": f"{request.part} executed successfully.", "table": table, "tables": tables, "schemaTables": schema_tables, "executionTimeMs": round(execution_ms, 3)}
            finally:
                try:
                    if cursor is not None:
                        cursor.close()
                finally:
                    try:
                        if previous_timeout is not None:
                            driver.timeout = previous_timeout
                    finally:
                        transaction.rollback()
    except Exception as error:
        return {"status": "Error", "message": str(error), "executionTimeMs": round(execution_ms, 3)}
