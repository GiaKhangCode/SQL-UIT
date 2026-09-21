from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base

# Tự động tạo bảng nếu chưa có
# (Trong thực tế nên dùng Alembic để migration)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SQL-UIT Backend", version="1.0.0")

# Cho phép Frontend Vite gọi API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to SQL-UIT API Backend!"}

from app.routers import auth, dashboard, problems, submissions

# Import routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard.router, prefix="/api/student/dashboard", tags=["Dashboard"])
app.include_router(problems.router, prefix="/api/problems", tags=["Problems"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
