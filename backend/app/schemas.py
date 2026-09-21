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

class DashboardStats(CamelModel):
    solved: int
    easy: int
    medium: int
    hard: int
    continuing: List[ProblemListResponse]
    deadlines: List[Any] = []
