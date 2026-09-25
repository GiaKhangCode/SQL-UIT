from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, UnicodeText, DateTime, JSON, Boolean
from sqlalchemy.orm import relationship
import datetime
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    initials = Column(String(10), nullable=False)
    role = Column(String(50), default="student")  # student, instructor, admin
    status = Column(String(50), default="Active") # Active, Inactive, Pending
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)
    department = Column(String(255), nullable=True)

class Problem(Base):
    __tablename__ = "problems"
    
    id = Column(String(50), primary_key=True)
    number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    topic = Column(String(100), nullable=False)
    difficulty = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    practice_listed = Column(Boolean, default=True)
    
    # Store JSON strings for schema definitions and expected results
    tables = Column(JSON, nullable=False)   # Array of DataTable definitions
    expected = Column(JSON, nullable=False) # Expected DataTable

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(String(50), ForeignKey("problems.id"), nullable=False)
    source = Column(String(100), nullable=False)  # Practice, Assignments, Contests
    context = Column(String(255), nullable=False)
    result = Column(String(100), nullable=False)  # Accepted, Wrong Answer, etc.
    score = Column(Integer, default=0)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    query_text = Column(Text, nullable=True)
    database_type = Column(String(50), nullable=True)
    evaluated_score = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)

class ProblemDraft(Base):
    __tablename__ = "problem_drafts"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(String(50), ForeignKey("problems.id"), nullable=False)
    draft_query = Column(Text, nullable=True)

class Favorite(Base):
    __tablename__ = "favorites"
    
    user_id = Column(String(50), ForeignKey("users.id"), primary_key=True)
    problem_id = Column(String(50), ForeignKey("problems.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ProblemList(Base):
    __tablename__ = "problem_lists"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ProblemListItem(Base):
    __tablename__ = "problem_list_items"
    
    list_id = Column(String(50), ForeignKey("problem_lists.id", ondelete="CASCADE"), primary_key=True)
    problem_id = Column(String(50), ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)

class AiChatSession(Base):
    __tablename__ = "ai_chat_sessions"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    problem_id = Column(String(50), ForeignKey("problems.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AiChatMessage(Base):
    __tablename__ = "ai_chat_messages"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    session_id = Column(String(50), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(10), nullable=False) # 'user' or 'ai'
    content = Column(UnicodeText, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
