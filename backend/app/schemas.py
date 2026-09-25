from pydantic import BaseModel, EmailStr, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import Optional, List, Dict, Any
from datetime import datetime

# ========================
# Pydantic models cho User
# ========================
class UserBase(BaseModel):
    email: str
    name: str
    initials: str
    role: str = "student"

class UserCreate(BaseModel):
    email: str
    name: str
    password: str

class LecturerRegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    department: str

class UserResponse(UserBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

# ========================
# Pydantic models cho Auth
# ========================
class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None

# ========================
# Pydantic models cho Data
# ========================
class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

class DataTable(CamelModel):
    name: str
    columns: List[str]
    rows: List[List[Any]]

class ProblemBase(CamelModel):
    id: str
    number: str
    title: str
    topic: Optional[str] = None
    topics: Optional[List[str]] = None
    difficulty: str
    practice_listed: bool
    database_type: Optional[str] = "SQL Server"

class ProblemListResponse(ProblemBase):
    progress: Optional[str] = None
    solved_by: int = Field(default=0, alias="solvedBy")
    attempted: int = 0
    acceptance: int = 0
    submissions: int = 0

class TestCaseSchema(CamelModel):
    tables: List[DataTable]
    expected: DataTable
    is_hidden: bool = False

class ProblemDetailResponse(ProblemBase):
    description: str
    requirements: str
    hint: Optional[str] = None
    schema_sql: Optional[str] = Field(default="", alias="schema")
    seed_data: Optional[str] = Field(default="", alias="seedData")
    reference_solution: Optional[str] = Field(default="", alias="referenceSolution")
    test_cases: Optional[List[Any]] = Field(default=None, alias="testCases")
    progress: Optional[str] = None

class TestCaseCreate(CamelModel):
    schema_sql: Optional[str] = Field(default="", alias="schema")
    seed_data: str = Field(..., alias="seedData")
    is_hidden: bool = False

class ProblemCreate(CamelModel):
    number: str
    title: str
    difficulty: str
    visibility: str = "Private"
    topics: str
    statement: str = Field(..., alias="statement")
    requirements: str
    hints: List[str] = Field(default_factory=list)
    database: str = "SQL Server"
    schema_sql: str = Field(default="", alias="schema")
    seed_data: str = Field(default="", alias="seedData")
    reference_solution: str = Field(..., alias="referenceSolution")
    test_cases: Optional[List[TestCaseCreate]] = Field(default=None, alias="testCases")

class ProblemValidateRequest(CamelModel):
    database: str = "SQL Server"
    schema_sql: str = Field(default="", alias="schema")
    seed_data: str = Field(default="", alias="seedData")
    reference_solution: str = Field(..., alias="referenceSolution")

class QueryRequest(CamelModel):
    query: str
    database: Optional[str] = "SQL Server"
    source: Optional[str] = "Practice"
    context: Optional[str] = "Practice"

class SubmissionResponse(CamelModel):
    id: str
    user_id: str
    problem_id: str
    source: str
    context: str
    result: str
    score: int
    submitted_at: datetime
    query_text: Optional[str] = Field(default=None, alias="query")
    database_type: Optional[str] = Field(default=None, alias="database")
    evaluated_score: Optional[int] = None
    feedback: Optional[str] = None

class TeacherSubmissionResponse(CamelModel):
    id: str
    student: str
    problem: str
    auto_score: int = Field(alias="autoScore")
    max_score: int = Field(alias="maxScore")
    final_score: Optional[int] = Field(alias="finalScore")
    status: str
    attempts: str
    query: str
    reference_solution: Optional[str] = Field(alias="referenceSolution", default=None)
    submitted_at: str = Field(alias="submittedAt")

class TeacherSubmissionSummary(CamelModel):
    id: str
    student: str
    problem: str
    score: int
    status: str
    submitted_at: str = Field(alias="submittedAt")

class DailySubmission(CamelModel):
    date: str
    count: int

class DashboardStats(CamelModel):
    solved: int
    easy: int
    medium: int
    hard: int
    continuing: List[ProblemListResponse]
    deadlines: List[Any] = []
    current_streak: int = 0
    submissions_per_day: List[DailySubmission] = []

class CustomListSchema(CamelModel):
    id: str
    name: str
    problem_ids: List[str] = Field(default_factory=list, alias="problemIds")

class PreferencesResponse(CamelModel):
    favorites: List[str]
    custom_lists: List[CustomListSchema] = Field(default_factory=list, alias="customLists")

class ListCreateRequest(CamelModel):
    name: str
    problem_ids: List[str] = Field(default_factory=list, alias="problemIds")

class TrendingProblem(CamelModel):
    id: str
    number: str
    title: str
    learners: int

class ChatMessage(CamelModel):
    role: str
    content: str

class AiChatRequest(CamelModel):
    problem_context: ProblemDetailResponse
    code_draft: str
    user_message: str
    session_id: Optional[str] = None
    chat_history: List[ChatMessage] = Field(default_factory=list) # Kept for backwards compatibility if needed

class AiChatResponse(CamelModel):
    response: str
    session_id: str

class AiChatMessageSchema(CamelModel):
    id: str
    role: str
    content: str
    created_at: datetime

class AiChatSessionSchema(CamelModel):
    id: str
    problem_id: str
    created_at: datetime
    updated_at: datetime

# ========================
# Pydantic models cho Admin
# ========================
class AdminUserResponse(CamelModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    last_active: str
    joined: str
    detail: str

class LecturerRequestResponse(CamelModel):
    id: str
    name: str
    email: str
    department: str
    submitted: str

class AdminUserUpdate(BaseModel):
    name: str
    email: str
    role: str
    status: str

class AdminUserCreate(BaseModel):
    name: str
    email: str
    role: str
    password: str

class AdminClassResponse(CamelModel):
    id: str
    course: str
    lecturer: str
    students: int
    status: str
    semester: str
    dates: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class OverviewStats(CamelModel):
    users: int
    classes: int
    pending_requests: int
    unassigned_classes: int
    submissions_today: int
    grading_errors: int

class ActivityLogResponse(CamelModel):
    id: str
    action: str
    by: str
    time: str

class GradingErrorResponse(CamelModel):
    id: str
    problem_title: str
    error_type: str

class AdminClassCreate(CamelModel):
    id: str
    course: str
    semester: str
    lecturer_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class AdminClassUpdate(CamelModel):
    course: Optional[str] = None
    semester: Optional[str] = None
    dates: Optional[str] = None
    lecturer_name: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

# ========================
# Pydantic models cho Teacher Classes
# ========================
class ClassCreate(CamelModel):
    id: str
    course: str
    term: str
    mode: str = "Individual"
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ClassUpdate(CamelModel):
    course: Optional[str] = None
    term: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None

class ClassResponse(CamelModel):
    id: str
    course: str
    term: str
    instructor_id: str
    mode: str
    status: str
    students: int = 0
    groups: List[Any] = Field(default_factory=list)
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ClassMemberResponse(CamelModel):
    id: str
    name: str
    email: str
    role: str
    joined_at: datetime

class ClassMemberAdd(CamelModel):
    student_id: str

# ========================
# Pydantic models cho Assignments / Contests
# ========================
class BuilderProblem(CamelModel):
    id: str
    points: int

class StudentOptions(CamelModel):
    hints: bool
    comments: bool
    leaderboard: bool
    ai_allowed: bool = Field(..., alias="aiAllowed")

class AssignmentCreate(CamelModel):
    title: str
    is_contest: bool = Field(default=False, alias="isContest")
    class_ids: List[str] = Field(..., alias="classIds")
    format: str
    instructions: str
    opens: datetime
    closes: datetime
    problems: List[BuilderProblem]
    student_options: StudentOptions = Field(..., alias="studentOptions")
    published: bool

class AssignmentResponse(CamelModel):
    id: str
    title: str
    is_contest: bool = Field(..., alias="isContest")
    classes: str # For list view
    problems: int # For list view
    due: str # For list view
    submitted: str # For list view
    average: str = "0%" # For list view
    awaiting: int = 0 # For list view
    review_id: Optional[str] = Field(default=None, alias="reviewId")
    status: str # For list view
    format: str
    instructions: str
    opens: datetime
    closes: datetime
    published: bool
    student_options: StudentOptions = Field(..., alias="studentOptions")
    problem_list: List[BuilderProblem] = Field(..., alias="problemList")
    class_ids: List[str] = Field(..., alias="classIds")

