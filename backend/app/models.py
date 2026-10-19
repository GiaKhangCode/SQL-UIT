from sqlalchemy import Column, String, Unicode, Integer, Float, ForeignKey, Text, UnicodeText, DateTime, JSON, Boolean
from sqlalchemy.orm import relationship
import datetime
import json
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    email = Column(Unicode(255), unique=True, index=True, nullable=False)
    hashed_password = Column(Unicode(255), nullable=False)
    name = Column(Unicode(255), nullable=False)
    initials = Column(Unicode(10), nullable=False)
    role = Column(Unicode(50), default="student")  # student, instructor, admin
    status = Column(Unicode(50), default="Active") # Active, Inactive, Pending
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)
    department = Column(Unicode(255), nullable=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_streak_date = Column(DateTime, nullable=True)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(Unicode(255), nullable=False)
    message = Column(UnicodeText, nullable=False)
    type = Column(Unicode(50), nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(Unicode(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id"), nullable=True)
    action = Column(Unicode(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User")

class Problem(Base):
    __tablename__ = "problems"
    
    id = Column(Unicode(50), primary_key=True)
    number = Column(Unicode(50), nullable=False)
    title = Column(Unicode(255), nullable=False)
    created_at = Column(DateTime, nullable=True, default=datetime.datetime.utcnow)
    topic = Column(Unicode(100), nullable=True)
    topics = Column(JSON, nullable=True)
    workspace_parts = Column(JSON, nullable=False, default=lambda: ["SQL"])
    difficulty = Column(Unicode(50), nullable=False)
    description = Column(UnicodeText, nullable=False)
    requirements = Column(UnicodeText, nullable=False)
    hint = Column(UnicodeText, nullable=True)
    practice_listed = Column(Boolean, default=True)
    database_type = Column(Unicode(50), default="SQL Server")
    schema_file_name = Column(Unicode(255), nullable=True)
    database_description = Column(JSON, nullable=False, default=list)
    database_description_visible = Column(Boolean, nullable=False, default=True)
    creator_id = Column(Unicode(50), ForeignKey("users.id"), nullable=True)
    
    # Store JSON strings for schema definitions and expected results (Legacy)
    tables = Column(JSON, nullable=True)   # Array of DataTable definitions
    expected = Column(JSON, nullable=True) # Expected DataTable
    test_cases = Column(JSON, nullable=True) # Array of TestCaseSchema

class ProblemSqlSolution(Base):
    __tablename__ = "problem_sql_solutions"

    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    problem_id = Column(Unicode(50), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(Unicode(120), nullable=False)
    query = Column(UnicodeText, nullable=False, default="")
    description = Column(UnicodeText, nullable=False, default="")
    expected = Column(JSON, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    time_limit_ms = Column(Integer, nullable=False, default=5000)
    order_index = Column(Integer, nullable=False, default=0)


class DatabaseLibraryEntry(Base):
    __tablename__ = "database_library_entries"

    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    instructor_id = Column(Unicode(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Unicode(255), nullable=False)
    database_file_name = Column(Unicode(255), nullable=True)
    create_table_file_name = Column(Unicode(255), nullable=True)
    insert_into_file_name = Column(Unicode(255), nullable=True)
    create_table_sql = Column(UnicodeText, nullable=False, default="")
    insert_into_sql = Column(UnicodeText, nullable=False, default="")
    datasets_json = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    @property
    def datasets(self):
        if self.datasets_json:
            try:
                datasets = json.loads(self.datasets_json)
                if isinstance(datasets, list) and datasets:
                    return datasets
            except (TypeError, json.JSONDecodeError):
                pass
        return [{
            "fileName": self.insert_into_file_name or "seed_1.sql",
            "sql": self.insert_into_sql or "",
        }]

class Topic(Base):
    __tablename__ = "topics"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    name = Column(Unicode(100), unique=True, nullable=False)

class ProblemTopic(Base):
    __tablename__ = "problem_topics"
    
    problem_id = Column(Unicode(50), ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)
    topic_id = Column(Unicode(50), ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True)

class TestCase(Base):
    __tablename__ = "test_cases_rel"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    problem_id = Column(Unicode(50), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    is_hidden = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    expected_query = Column(UnicodeText, nullable=True)

class TestCaseScript(Base):
    __tablename__ = "test_case_scripts"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    test_case_id = Column(Unicode(50), ForeignKey("test_cases_rel.id", ondelete="CASCADE"), nullable=False)
    table_name = Column(Unicode(100), nullable=False)
    create_script = Column(UnicodeText, nullable=False)
    insert_script = Column(UnicodeText, nullable=False)
    is_expected = Column(Boolean, default=False)

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(Unicode(50), ForeignKey("problems.id"), nullable=False)
    source = Column(Unicode(100), nullable=False)  # Practice, Assignments, Contests
    context = Column(Unicode(255), nullable=False)
    result = Column(Unicode(100), nullable=False)  # Accepted, Wrong Answer, etc.
    score = Column(Integer, default=0)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    query_text = Column(UnicodeText, nullable=True)
    database_type = Column(Unicode(50), nullable=True)
    evaluated_score = Column(Integer, nullable=True)
    feedback = Column(UnicodeText, nullable=True)

class ProblemDraft(Base):
    __tablename__ = "problem_drafts"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(Unicode(50), ForeignKey("problems.id"), nullable=False)
    draft_query = Column(UnicodeText, nullable=True)

class Favorite(Base):
    __tablename__ = "favorites"
    
    user_id = Column(Unicode(50), ForeignKey("users.id"), primary_key=True)
    problem_id = Column(Unicode(50), ForeignKey("problems.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ProblemList(Base):
    __tablename__ = "problem_lists"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id"), nullable=False)
    name = Column(Unicode(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ProblemListItem(Base):
    __tablename__ = "problem_list_items"
    
    list_id = Column(Unicode(50), ForeignKey("problem_lists.id", ondelete="CASCADE"), primary_key=True)
    problem_id = Column(Unicode(50), ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)

class AiChatSession(Base):
    __tablename__ = "ai_chat_sessions"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    user_id = Column(Unicode(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(Unicode(50), ForeignKey("problems.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AiChatMessage(Base):
    __tablename__ = "ai_chat_messages"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    session_id = Column(Unicode(50), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(Unicode(10), nullable=False) # 'user' or 'ai'
    content = Column(UnicodeText, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Class(Base):
    __tablename__ = "classes"
    
    id = Column(Unicode(50), primary_key=True)
    course = Column(Unicode(255), nullable=False)
    term = Column(Unicode(100), nullable=False)
    instructor_id = Column(Unicode(50), ForeignKey("users.id"), nullable=True)
    start_date = Column(Unicode(50), nullable=True)
    end_date = Column(Unicode(50), nullable=True)
    status = Column(Unicode(50), default="Active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"
    
    class_id = Column(Unicode(50), ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True)
    student_id = Column(Unicode(50), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(Unicode(50), default="Member")
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    title = Column(Unicode(255), nullable=False)
    is_contest = Column(Boolean, default=False)
    instructions = Column(UnicodeText, nullable=True)
    audience_type = Column(Unicode(20), nullable=False, default="classes")
    short_description = Column(Unicode(180), nullable=True)
    description = Column(UnicodeText, nullable=True)
    rules = Column(UnicodeText, nullable=True)
    banner_url = Column(Unicode(255), nullable=True)
    banner_source_url = Column(Unicode(255), nullable=True)
    banner_crop = Column(Unicode(160), nullable=True)
    opens = Column(DateTime, nullable=True)
    closes = Column(DateTime, nullable=True)
    published = Column(Boolean, default=False)
    instructor_id = Column(Unicode(50), ForeignKey("users.id"), nullable=True)
    
    # Student Options
    hints_enabled = Column(Boolean, default=True)
    comments_enabled = Column(Boolean, default=True)
    leaderboard_enabled = Column(Boolean, default=False)
    ai_allowed = Column(Boolean, default=True)
    exam_mode = Column(Boolean, nullable=False, default=False)
    show_scores_after_submit = Column(Boolean, nullable=False, default=True)
    max_submissions = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class ActivityAttempt(Base):
    __tablename__ = "activity_attempts"

    assignment_id = Column(Unicode(50), ForeignKey("assignments.id"), primary_key=True)
    user_id = Column(Unicode(50), ForeignKey("users.id"), primary_key=True)
    status = Column(Unicode(30), nullable=False, default="active")
    drafts = Column(JSON, nullable=False, default=dict)
    violations = Column(JSON, nullable=False, default=list)
    started_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    finish_reason = Column(Unicode(50), nullable=True)


class AssignmentClass(Base):
    __tablename__ = "assignment_classes"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    assignment_id = Column(Unicode(50), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Unicode(50), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

class AssignmentProblem(Base):
    __tablename__ = "assignment_problems"
    
    id = Column(Unicode(50), primary_key=True, default=generate_uuid)
    assignment_id = Column(Unicode(50), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    problem_id = Column(Unicode(50), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    points = Column(Integer, default=10)
    order_index = Column(Integer, default=0)
    workspace_parts = Column(JSON, nullable=True)
    dataset_visibility = Column(JSON, nullable=False, default=dict)
    database_structure_visible = Column(Boolean, nullable=False, default=True)
    database_description_visible = Column(Boolean, nullable=False, default=True)
