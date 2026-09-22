import json
from passlib.context import CryptContext
from app.database import SessionLocal, engine, Base
from app.models import User, Problem, Submission
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def seed_data():
    db = SessionLocal()
    
    # 1. Tạo User mẫu
    demo_user = db.query(User).filter(User.email == "student@demo.local").first()
    if not demo_user:
        demo_user = User(
            id="student-demo",
            email="student@demo.local",
            hashed_password=get_password_hash("password123"), # Mật khẩu giả định
            name="Huy Lai",
            initials="HL",
            role="student"
        )
        db.add(demo_user)
        print("Đã tạo User: student@demo.local")

    # 1.5 Tạo Instructor mẫu
    instructor_user = db.query(User).filter(User.email == "instructor@demo.local").first()
    if not instructor_user:
        instructor_user = User(
            id="instructor-demo",
            email="instructor@demo.local",
            hashed_password=get_password_hash("password123"),
            name="Giảng Viên",
            initials="GV",
            role="instructor"
        )
        db.add(instructor_user)
        print("Đã tạo User: instructor@demo.local")

    # 2. Tạo Problem mẫu (p1)
    p1 = db.query(Problem).filter(Problem.id == "p1").first()
    if not p1:
        customers_table = {
            "name": "Customers",
            "columns": ["customer_id", "customer_name"],
            "rows": [
                [1, "Minh Anh"], [2, "Bao Tran"], [3, "Huy Lai"], [4, "Ngoc Linh"]
            ]
        }
        orders_table = {
            "name": "Orders",
            "columns": ["order_id", "customer_id", "amount"],
            "rows": [
                [101, 1, 120], [102, 3, 85], [103, 1, 60]
            ]
        }
        expected_table = {
            "name": "Expected result",
            "columns": ["customer_id", "customer_name"],
            "rows": [
                [2, "Bao Tran"], [4, "Ngoc Linh"]
            ]
        }
        
        p1 = Problem(
            id="p1",
            number="014",
            title="Customers without orders",
            topic="JOIN",
            difficulty="Medium",
            description="Given the Customers and Orders tables, find customers who have never placed an order.",
            requirements="Return customer_id and customer_name. Sort the result by customer_id in ascending order.",
            hint="Which join preserves customers without a matching order? Consider checking for a missing value after joining.",
            practice_listed=True,
            tables=[customers_table, orders_table],
            expected=expected_table
        )
        db.add(p1)
        print("Đã tạo Problem: p1")

    db.commit()
    db.close()
    print("Seeding hoàn tất!")

if __name__ == "__main__":
    # Tự động tạo bảng nếu chưa có (chắc chắn hơn)
    Base.metadata.create_all(bind=engine)
    seed_data()
