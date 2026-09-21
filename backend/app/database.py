import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Cấu hình engine cho SQL Server qua pyodbc
# fast_executemany=True giúp tăng tốc độ chèn dữ liệu
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    fast_executemany=True,
    # echo=True để debug câu lệnh SQL nếu cần
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency dùng để lấy session cho các request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
