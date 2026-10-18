"""Persist the teacher-only SQL solution and its student execution limit."""
import uuid

from app.models import ProblemSqlSolution
from app.schemas import SqlSolutionConfig


def stored_solutions(db, problem_id):
    return db.query(ProblemSqlSolution).filter(
        ProblemSqlSolution.problem_id == problem_id
    ).order_by(ProblemSqlSolution.order_index).all()


def save_solutions(db, problem_id, solutions):
    if solutions is None:
        return  # Older clients can still edit a problem without dropping its solutions.
    existing = {row.id: row for row in stored_solutions(db, problem_id)}
    keep = set()
    for index, solution in enumerate(solutions):
        row = existing.get(solution.id)
        if row is None:
            # Never reuse an ID owned by another problem.
            solution_id = solution.id if db.get(ProblemSqlSolution, solution.id) is None else str(uuid.uuid4())
            row = ProblemSqlSolution(id=solution_id, problem_id=problem_id)
            db.add(row)
        row.name = solution.name
        row.query = solution.query
        row.enabled = solution.enabled
        row.time_limit_ms = solution.time_limit_ms
        row.order_index = index
        keep.add(row.id)
    for row in existing.values():
        if row.id not in keep:
            db.delete(row)


def solution_response(row):
    return SqlSolutionConfig(id=row.id, name=row.name, query=row.query,
                             enabled=row.enabled, timeLimitMs=row.time_limit_ms)
