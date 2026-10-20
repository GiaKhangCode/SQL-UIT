<div align="center">

# 🎓 SQL-UIT — Nền Tảng Luyện Tập & Chấm Điểm SQL Trực Tuyến

**Hệ sinh thái học tập & thi đấu SQL toàn diện cho sinh viên, giảng viên và quản trị viên, tích hợp trợ lý AI thông minh.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2019%2B-CC292B.svg?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![Gemini AI](https://img.shields.io/badge/Google_GenAI-Gemini-8E75C2.svg?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[Tính Năng](#-tính-năng-nổi-bật) • [Kiến Trúc](#-kiến-trúc-hệ-thống) • [Cấu Trúc Thư Mục](#-cấu-trúc-dự-án) • [Cài Đặt & Khởi Chạy](#-hướng-dẫn-cài-đặt-và-khởi-chạy) • [Tài Khoản Thử Nghiệm](#-tài-khoản-thử-nghiệm-demo-accounts) • [Tổng Quan API](#-tổng-quan-api) • [Kiểm Thử](#-kiểm-thử-testing)

</div>

---

## 📖 Giới Thiệu (Overview)

**SQL-UIT** là nền tảng đào tạo và đánh giá kỹ năng cơ sở dữ liệu quan hệ (RDBMS) chuẩn SQL Server / T-SQL, được thiết kế nhằm hiện đại hóa việc dạy và học SQL trong môi trường đại học. Dự án giải quyết các rào cản thực tế:

- Sinh viên không cần cài đặt môi trường database phức tạp trên máy cá nhân để bắt đầu luyện tập.
- Kiểm tra tự động kết quả truy vấn, bắt lỗi cú pháp và trả về gợi ý chi tiết tức thì.
- Giảng viên dễ dàng xây dựng ngân hàng bài tập với các test case ẩn/công khai, giao bài theo lớp và tổ chức kỳ thi có bảng xếp hạng.
- Cơ chế Sandbox an toàn sử dụng phân tích AST và bảng tạm (Temporary Tables), bảo vệ toàn vẹn dữ liệu hệ thống.

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 🧑‍🎓 Dành Cho Sinh Viên (Student Experience)

- **Trình soạn thảo SQL chuyên nghiệp:** Tích hợp CodeMirror 6 với cú pháp highlight, gợi ý code, tự động format câu lệnh (`sql-formatter`) và hỗ trợ chuyển đổi giao diện Dark/Light mode.
- **Phản hồi & Chấm điểm tức thì (Instant Sandbox Feedback):**
  - Phân tích cú pháp AST bằng `sqlglot` để chỉ rõ vị trí dòng/cột gặp lỗi cú pháp.
  - Chạy thử nghiệm an toàn bằng cơ chế bảng tạm (`#TableName`), so sánh tập kết quả chính xác tuyệt đối với đáp án mẫu.
  - Phân loại trạng thái chi tiết: _Accepted_, _Wrong Answer_, _Partial_, _Runtime Error_, _Syntax Error_.
- **Luyện tập tự do & Làm bài tập lớp (Practice & Assignments):**
  - Danh mục bài tập phong phú phân chia theo độ khó (Easy, Medium, Hard) và chủ đề (SELECT, WHERE, ORDER BY, GROUP BY, HAVING, JOIN, SUBQUERY, CTE, WINDOW FUNCTION,...).
  - Tự động lưu nháp câu lệnh truy vấn (Draft Auto-save) theo từng bài toán.
  - Mục yêu thích (Favorites) và danh sách bài tập tùy biến (Custom Problem Lists).
- **Kỳ thi trực tuyến (Contest Mode):**
  - Tham gia các kỳ thi có giới hạn thời gian mở/đóng (`opens` / `closes`).
  - Bảng xếp hạng thời gian thực (Live Leaderboard) và banner kỳ thi chuyên nghiệp.
  - Kiểm soát quyền trợ giúp (tự động vô hiệu hóa AI hoặc gợi ý trong thời gian thi nếu giảng viên yêu cầu).
- **Trợ lý AI Gemini (AI SQL Tutor):** Chat trực tiếp với trợ lý thông minh theo từng bài toán để nhận giải thích lỗi và gợi ý hướng tư duy mà không làm lộ trực tiếp câu truy vấn đáp án.

### 👨‍🏫 Dành Cho Giảng Viên (Instructor Experience)

- **Quản lý lớp học (Class Management):** Tạo lớp học, quản lý danh sách sinh viên theo mã lớp hoặc import danh sách tự động.
- **Soạn thảo bài tập (Problem Studio):**
  - Định nghĩa lược đồ DDL, nạp dữ liệu mẫu DML và viết câu lệnh đáp án tham chiếu.
  - Thiết lập bộ test cases linh hoạt (công khai để sinh viên đối chiếu hoặc ẩn để chấm điểm nghiêm ngặt).
  - Công cụ Sandbox Validation kiểm tra tính hợp lệ của đề bài trước khi công bố.
- **Tổ chức bài tập & Kỳ thi (Assignments & Contests):**
  - Giao bài tập theo từng lớp hoặc tạo kỳ thi mở rộng cho toàn bộ sinh viên (`audience_type`).
  - Đặt trọng số điểm cho từng bài toán (`points`), quy định hạn chót và các tùy chọn hỗ trợ (Hints, AI, Comments).
- **Thống kê & Chấm bài:** Theo dõi tiến độ làm bài, bảng điểm tổng quan và xem chi tiết lịch sử submit của từng sinh viên.

### 🛡️ Dành Cho Quản Trị Viên (Admin Control)

- **Giám sát hệ thống (System Overview):** Báo cáo số lượng người dùng, lớp học, bài toán, submission và theo dõi nhật ký hoạt động / lỗi chấm bài (`activity_logs`, `grading_errors`).
- **Quản lý người dùng toàn diện:** Duyệt/khóa tài khoản, cấp quyền (Role: Student, Instructor, Admin), import danh sách người dùng hàng loạt.
- **Quản trị toàn bộ lớp học:** Giám sát và điều phối tất cả các lớp học trên nền tảng.

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture)

```mermaid
graph TD
    Client["React + Vite Frontend (Port 5173/5174)\nTypeScript / CodeMirror 6 / Lucide Icons"]
    Proxy["Vite Proxy Reverse Proxy\n/api/* -> http://127.0.0.1:8000"]
    Backend["FastAPI Backend (Port 8000)\nPython 3.8+ / Uvicorn"]
    Auth["JWT Authentication & Bcrypt Security"]
    AST["SQLGlot AST Parser\nSafety Checks & T-SQL Dialect"]
    Sandbox["Sandbox Engine\nLocal Temp Tables (#Table)"]
    AI["Google Gemini API\n(google-genai SDK)"]
    DB[("Microsoft SQL Server\n/ Azure SQL Database (SQLUIT)")]

    Client -->|HTTP / REST| Proxy
    Proxy -->|Forward /api| Backend
    Backend --> Auth
    Backend --> AST
    AST -->|Rewrite queries| Sandbox
    Sandbox -->|Execute isolated tests| DB
    Backend -->|pyodbc / SQLAlchemy 2.0| DB
    Backend -->|Contextual Prompts| AI
```

### 🔒 Cơ Chế Sandbox Cách Ly An Toàn

1. **Kiểm tra an toàn AST:** `sqlglot` duyệt cây cú pháp và chặn ngay lập tức các lệnh phá hoại DDL/DML như `DROP`, `ALTER`, `DELETE`, `UPDATE`, `INSERT`, `COMMIT`, `ROLLBACK`. Chỉ cho phép các mệnh đề `SELECT` và `WITH ... AS` (CTE).
2. **Rewrite câu truy vấn:** Toàn bộ bảng dữ liệu và CTE được tự động ánh xạ sang bảng tạm cục bộ của SQL Server (tiền tố `#TableName`).
3. **Thực thi cô lập:** Dữ liệu kiểm thử của từng test case được nạp vào bảng tạm trong phiên kết nối và tự động dọn dẹp khi kết nối trả về Connection Pool.

---

## 📂 Cấu Trúc Dự Án (Project Structure)

```text
sql-uit-deploy/
├── SQL-UIT_backend/                     # Mã nguồn Backend (FastAPI)
│   ├── app/
│   │   ├── routers/                     # Các API Router phân theo nghiệp vụ
│   │   │   ├── admin_classes.py         # Quản lý lớp học dành cho Admin
│   │   │   ├── admin_overview.py        # Thống kê, log hoạt động & giám sát lỗi
│   │   │   ├── admin_users.py           # Quản lý & duyệt người dùng
│   │   │   ├── ai.py                    # Chat trợ lý AI Gemini theo phiên
│   │   │   ├── assignments.py           # Quản lý Bài tập & Kỳ thi (Contests)
│   │   │   ├── auth.py                  # Đăng nhập, đăng ký, xác thực JWT
│   │   │   ├── classes.py               # Quản lý lớp học dành cho Giảng viên
│   │   │   ├── dashboard.py             # Thống kê học tập dành cho Sinh viên
│   │   │   ├── notifications.py         # Hệ thống thông báo người dùng
│   │   │   ├── preferences.py           # Bài tập yêu thích & danh sách tùy biến
│   │   │   ├── problems.py              # Xử lý bài toán, chạy thử & nộp bài
│   │   │   ├── student_assignments.py   # Lấy bài tập/kỳ thi của sinh viên
│   │   │   └── submissions.py           # Tra cứu lịch sử nộp bài & chấm điểm
│   │   ├── services/
│   │   │   └── sandbox.py               # AST parsing, sandbox query & bảng tạm
│   │   ├── database.py                  # Cấu hình SQLAlchemy Engine & Session
│   │   ├── models.py                    # Định nghĩa DB Models quan hệ
│   │   ├── schemas.py                   # Pydantic Schemas validate dữ liệu
│   │   ├── security.py                  # Mã hóa mật khẩu & xử lý JWT
│   │   └── main.py                      # Khởi tạo FastAPI App & gắn kết Router
│   ├── scripts/
│   │   ├── create_db.py                 # Tự động tạo cơ sở dữ liệu SQLUIT
│   │   ├── seed.py                      # Nạp tài khoản demo ban đầu
│   │   ├── seed_dev_data.py             # Nạp dữ liệu phong phú (Problems, Contests,...)
│   │   └── reset_db.py                  # Xóa sạch constraints/tables & tạo mới DB
│   ├── tests/                           # Kiểm thử backend (unittest)
│   ├── Dockerfile                       # Dockerfile triển khai backend với ODBC 18
│   └── requirements.txt                 # Danh sách gói Python phụ thuộc
│
├── SQL_UIT-Frontend/                    # Mã nguồn Frontend (React + Vite)
│   ├── src/
│   │   ├── app/                         # App.tsx và định tuyến Router chính
│   │   ├── components/                  # UI Components (Editor, Modals, Navbar,...)
│   │   ├── pages/                       # Các màn hình phân theo vai trò
│   │   │   ├── admin/                   # Màn hình Admin (Dashboard, Users, Classes)
│   │   │   ├── auth/                    # Màn hình Đăng nhập & Đăng ký
│   │   │   ├── student/                 # Workspace, Practice, Contests, Dashboard
│   │   │   └── teacher/                 # Classes, Assignment Builder, Problem Studio
│   │   ├── services/                    # Tầng giao tiếp API (apiClient, auth, student, teacher, admin)
│   │   ├── context/                     # Quản lý trạng thái (AuthContext)
│   │   ├── styles/                      # Thiết lập giao diện CSS & Theme
│   │   └── utils/                       # Hàm tiện ích xử lý dữ liệu
│   ├── tests/                           # Kiểm thử dịch vụ frontend (services.test.mjs)
│   ├── scripts/                         # Script kiểm thử luồng thực tế (Auth, Assignments)
│   ├── package.json                     # Cấu hình phụ thuộc & scripts Frontend
│   └── vite.config.ts                   # Cấu hình Vite & Reverse Proxy `/api`
│
├── LICENSE                              # Giấy phép mã nguồn mở MIT
└── README.md                            # Tài liệu dự án
```

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)

### 1. Yêu Cầu Tiên Quyết (Prerequisites)

- **Node.js** `>= 18.0.0` & **npm**
- **Python** `>= 3.8` (khuyên dùng Python 3.10 hoặc 3.11) & **pip**
- **Microsoft SQL Server** (hoặc Azure SQL Database / SQL Server Express / LocalDB)
- **ODBC Driver 17 for SQL Server** (hoặc ODBC Driver 18) tương thích với hệ điều hành

---

### 2. Thiết Lập Backend (`SQL-UIT_backend`)

Mở Terminal tại thư mục gốc của dự án và chuyển vào thư mục backend:

```bash
# 1. Đi đến thư mục backend
cd SQL-UIT_backend

# 2. Tạo và kích hoạt môi trường ảo (Virtual Environment)
# Trên Windows (PowerShell):
python -m venv venv
.\venv\Scripts\activate

# Trên macOS / Linux:
# python3 -m venv venv
# source venv/bin/activate

# 3. Cài đặt các gói phụ thuộc
pip install -r requirements.txt

# 4. Thiết lập biến môi trường
# Tạo file .env dựa trên mẫu cấu hình:
# Windows PowerShell:
copy .env.example .env
# Linux/macOS:
# cp .env.example .env
```

> 📝 **Cấu hình file `SQL-UIT_backend/.env`:**
>
> ```env
> DATABASE_URL=mssql+pyodbc://sa:YourPassword@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server
> SECRET_KEY=your-super-secret-jwt-key
> GEMINI_API_KEY=your-google-gemini-api-key
> ```
>
> _(Gợi ý: Nếu dùng Windows Authentication, connection string có dạng: `mssql+pyodbc://@localhost/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes`)_

```bash
# 5. Khởi tạo Database và nạp dữ liệu mẫu
python scripts/create_db.py

# Nạp dữ liệu tài khoản demo cơ bản:
python scripts/seed.py

# (Tùy chọn) Nạp dữ liệu phong phú phục vụ kiểm thử (10 bài tập, lớp học, assignment):
python -m scripts.seed_dev_data

# 6. Khởi động server FastAPI
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> 💡 **Khắc phục khi thay đổi cấu trúc bảng:** Dự án tạo bảng tự động qua SQLAlchemy metadata. Nếu bạn gặp lỗi thiếu cột do schema cũ, hãy chạy `python scripts/reset_db.py` để drop sạch bảng cũ và khởi tạo lại cấu trúc mới nhất một cách an toàn.

- API Documentation tự động có sẵn tại: **`http://127.0.0.1:8000/docs`** (Swagger UI) hoặc **`http://127.0.0.1:8000/redoc`**.

---

### 3. Thiết Lập Frontend (`SQL_UIT-Frontend`)

Mở một cửa sổ Terminal mới từ thư mục gốc dự án:

```bash
# 1. Đi đến thư mục frontend
cd SQL_UIT-Frontend

# 2. Cài đặt các gói node_modules
npm install

# 3. Khởi chạy máy chủ phát triển
npm run dev
```

Ứng dụng Frontend sẽ chạy tại địa chỉ: **`http://127.0.0.1:5173`** (hoặc cổng được hiển thị trong terminal).

> 💡 **Cơ chế Proxy:** File `vite.config.ts` đã được cấu hình chuyển tiếp toàn bộ request `/api/*` tự động sang máy chủ backend `http://127.0.0.1:8000`, không phát sinh lỗi CORS trong môi trường phát triển.

---

## 🔑 Tài Khoản Thử Nghiệm (Demo Accounts)

Sau khi chạy lệnh `python scripts/seed.py`, bạn có thể đăng nhập ngay với các tài khoản thử nghiệm sau:

| Vai trò (Role) | Email                   | Mật khẩu mặc định | Quyền hạn chính                                                                       |
| :------------- | :---------------------- | :---------------- | :------------------------------------------------------------------------------------ |
| **Admin**      | `admin@demo.local`      | `123`             | Quản trị người dùng, duyệt tài khoản, quản lý toàn bộ lớp học, xem dashboard thống kê |
| **Instructor** | `instructor@demo.local` | `password123`     | Soạn thảo bài tập, cấu hình test cases, tạo lớp, giao assignment và tổ chức kỳ thi    |
| **Student**    | `student@demo.local`    | `password123`     | Luyện tập tự do, làm bài tập lớp, tham gia kỳ thi, nhận trợ giúp từ AI                |

_(Nếu chạy thêm `python -m scripts.seed_dev_data`, bạn có thêm các tài khoản sinh viên từ `student01@demo.local` đến `student07@demo.local` với mật khẩu `password123`)_

---

## 📡 Tổng Quan API (API Overview)

FastAPI cung cấp giao diện Swagger OpenAPI tự động tại đường dẫn `/docs`. Dưới đây là các nhóm API chính:

| Nhóm                       | Endpoint chính                                                                                                                                                  | Mô tả                                                                                   |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Auth**                   | `POST /api/auth/login`<br>`POST /api/auth/register`<br>`POST /api/auth/register-lecturer`<br>`GET /api/auth/me`                                                 | Đăng nhập, đăng ký tài khoản (sinh viên / giảng viên) & cấp JWT token                   |
| **Problems**               | `GET /api/problems`<br>`POST /api/problems`<br>`POST /api/problems/{id}/run`<br>`POST /api/problems/{id}/submit`<br>`POST /api/problems/validate`               | Danh sách bài tập, tạo bài mới, chạy thử truy vấn, nộp bài chấm điểm & kiểm tra sandbox |
| **Assignments & Contests** | `GET /api/assignments`<br>`POST /api/assignments`<br>`PUT /api/assignments/{id}`<br>`POST /api/assignments/banners`<br>`GET /api/assignments/{id}/submissions`  | Quản lý bài tập theo lớp và kỳ thi (Contests), tải ảnh banner, xem bảng điểm            |
| **Student Work**           | `GET /api/student/assignments`<br>`GET /api/student/dashboard`<br>`GET /api/student/preferences`                                                                | Xem bài tập/kỳ thi được giao, thống kê dashboard cá nhân và danh sách yêu thích         |
| **Teacher Classes**        | `GET /api/teacher/classes`<br>`POST /api/teacher/classes`<br>`GET /api/teacher/classes/{id}/members`<br>`POST /api/teacher/classes/{id}/members/import`         | Quản lý lớp học của giảng viên, thêm sinh viên hoặc import danh sách                    |
| **Admin Controls**         | `GET /api/admin/users`<br>`PUT /api/admin/users/{email}`<br>`GET /api/admin/classes`<br>`GET /api/admin/overview/stats`<br>`GET /api/admin/overview/activities` | Quản trị người dùng, duyệt giảng viên, quản lý toàn bộ lớp học và nhật ký hệ thống      |
| **AI Assistant**           | `POST /api/ai/chat`<br>`GET /api/ai/sessions/{problem_id}`<br>`GET /api/ai/sessions/messages/{session_id}`                                                      | Chat với trợ lý Gemini AI theo ngữ cảnh bài toán và quản lý lịch sử trò chuyện          |
| **Submissions**            | `GET /api/submissions`<br>`GET /api/submissions/{id}`<br>`PUT /api/submissions/{id}/review`                                                                     | Tra cứu chi tiết submission, chấm bài và phản hồi của giảng viên                        |
| **Notifications**          | `GET /api/notifications`<br>`GET /api/notifications/unread-count`<br>`PUT /api/notifications/read-all`                                                          | Hệ thống thông báo và đếm thông báo chưa đọc                                            |

---

## 🧪 Kiểm Thử (Testing)

### Frontend Tests

Tại thư mục `SQL_UIT-Frontend`:

```bash
# 1. Kiểm tra type TypeScript và chạy kiểm thử Unit Test cho Services
npm run test

# 2. Chạy kịch bản kiểm thử quy trình thực tế (Real Flow Scripts):
node scripts/verifyRealAuth.mjs
node scripts/verifyAssignmentFlow.mjs
```

### Backend Tests

Tại thư mục `SQL-UIT_backend`:

```bash
# Kích hoạt môi trường ảo trước:
.\venv\Scripts\activate

# Chạy toàn bộ các ca kiểm thử với unittest tiêu chuẩn:
python -m unittest discover tests

# (Hoặc sử dụng pytest nếu môi trường đã cài đặt):
# pytest
```

---

<div align="center">
  <sub>Phát triển bởi nhóm <b>Kỵ Sĩ Mùa Xuân</b> • Trường Đại học Công nghệ Thông tin (ĐHQG-HCM)</sub>
</div>
