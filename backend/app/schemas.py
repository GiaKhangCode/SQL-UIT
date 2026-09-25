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
    topic: str
    difficulty: str
    practice_listed: bool

class ProblemListResponse(ProblemBase):
    progress: Optional[str] = None

class ProblemDetailResponse(ProblemBase):
    description: str
    requirements: str
    hint: Optional[str] = None
    tables: List[DataTable]
    expected: DataTable
    progress: Optional[str] = None

class ProblemCreate(CamelModel):
    number: str
    title: str
    topic: str
    difficulty: str
    practice_listed: bool = True
    description: str
    requirements: str
    hint: Optional[str] = None
    tables: List[DataTable]
    expected: DataTable

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
