Dưới đây là **Lộ trình chuyển đổi toàn diện trong 3 tuần** dành cho **đội ngũ 5 lập trình viên**, đảm bảo chuyển đổi toàn bộ Backend sang **PHP (khuyến nghị dùng Laravel 11)** và Database nghiệp vụ sang **MySQL**, trong khi vẫn giữ nguyên cơ chế Sandbox trên **SQL Server** và không làm gián đoạn Frontend React hiện tại.

---

### 1. Phân chia vai trò & Trách nhiệm (5 Thành viên)

| Thành viên                | Vai trò chính                   | Nhiệm vụ trọng tâm                                                                                                                                           |
| :------------------------ | :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dev 1 (Tech Lead)**     | **Kiến trúc & Hạ tầng Core**    | Khởi tạo dự án Laravel 11, cấu hình Dual-DB (MySQL + SQL Server), hệ thống Auth (JWT/Sanctum), RBAC Middleware, chuẩn hóa API Spec cho cả đội.               |
| **Dev 2 (Engine Dev)**    | **Sandbox & Engine Chấm thi**   | Viết module kết nối SQL Server (`pdo_sqlsrv`), chuyển đổi logic tạo schema cá nhân, Query Rewriter, bộ chấm điểm DDL, DML và SQL queries.                    |
| **Dev 3 (Content Dev)**   | **Ngân hàng đề & Học vụ**       | Chuyển đổi toàn bộ API Quản lý Ngân hàng câu hỏi (Problems), Test Cases, Bài tập (Assignments), và Quản lý Lớp học (Classes).                                |
| **Dev 4 (Operation Dev)** | **Kỳ thi, Bài nộp & Thống kê**  | Chuyển đổi API Quản lý Kỳ thi (Contests CRUD), Lịch sử bài nộp (Submissions), Chấm thủ công (Review), Dashboard, Thông báo & Preferences.                    |
| **Dev 5 (QA & DevOps)**   | **DevOps, Ghép nối & Kiểm thử** | Docker hóa môi trường (PHP 8.2 + MySQL + `pdo_sqlsrv`), viết Postman Collection kiểm thử, test tích hợp với React Frontend, kiểm thử chịu tải (Stress test). |

---

### 2. Kế hoạch chi tiết theo từng tuần

```
TUẦN 1: NỀN TẢNG, CƠ SỞ DỮ LIỆU & XÁC THỰC
├── Dev 1: Khởi tạo Laravel 11, Migration MySQL, Auth & RBAC
├── Dev 2: Cấu hình driver SQL Server (pdo_sqlsrv), chuyển đổi Query Rewriter
├── Dev 3: Chuyển đổi API Problems & Test Cases
├── Dev 4: Chuyển đổi API Classes, Preferences & Notifications
└── Dev 5: Setup Docker Compose (Nginx, PHP 8.2, MySQL 8), chuẩn bị tài liệu API

TUẦN 2: CHUYỂN ĐỔI NGHIỆP VỤ & ENGINE CHẤM BÀI
├── Dev 1: Module Admin (Quản lý User, Phê duyệt Giảng viên)
├── Dev 2: Hoàn thiện Engine Sandbox: Tạo schema, chạy DDL/DML, chấm toàn diện
├── Dev 3: Chuyển đổi API Assignments & Bài tập sinh viên
├── Dev 4: Chuyển đổi API Contests, Submissions & Dashboard thống kê
└── Dev 5: Viết Test Automation cho toàn bộ API của Tuần 1 & Tuần 2

TUẦN 3: GHÉP NỐI FRONTEND, KIỂM THỬ TẢI & GO-LIVE
├── Cả đội: Trỏ Frontend React sang Backend PHP mới, sửa lỗi sai lệch dữ liệu
├── Dev 2 + Dev 5: Chạy Stress Test mô phỏng 500 - 1.000 sinh viên thi đồng thời
├── Dev 1 + Dev 4: Chuyển đổi dữ liệu cũ (Data Migration script từ CSDL cũ sang MySQL)
└── Cả đội: Diễn tập thi thử (Mock Exam) & Triển khai chính thức lên Production
```

---

### 3. Chi tiết công việc từng tuần cho từng người

#### 📅 TUẦN 1: Thiết lập nền tảng, CSDL MySQL & Cấu hình 2 Database

- **Dev 1 (Lead):**
  - Tạo khung dự án Laravel 11 API-only. Cấu hình 2 connection trong `config/database.php`: `mysql` (default) và `sqlsrv`.
  - Viết toàn bộ file Migration tạo bảng trên MySQL: `users`, `classes`, `class_members`, `problems`, `test_cases`, `assignments`, `contests`, `submissions`, `notifications`, `preferences`.
  - Triển khai hệ thống Auth bằng **Laravel Sanctum / JWT**: Đăng ký, Đăng nhập, Duyệt tài khoản Giảng viên (`Pending`).
  - Viết Middleware phân quyền RBAC: `RoleMiddleware` (`admin`, `instructor`, `student`).

- **Dev 2 (Engine Dev):**
  - Cài đặt và cấu hình thành công extension `pdo_sqlsrv` trên PHP để kết nối với SQL Server trên Azure/VPS.
  - Chuyển mã Python của hàm `rewrite_query_for_schema` sang PHP (tự động thêm tiền tố `[schema_name].[table]`).
  - Viết Service quản lý Schema trên SQL Server: tạo schema, kiểm tra schema, xoá schema khi hết giờ thi.

- **Dev 3 (Content Dev):**
  - Viết Models, Repositories, Controllers cho **Problems**: CRUD ngân hàng câu hỏi, lọc câu hỏi theo tag, độ khó.
  - Viết API quản lý **Test Cases** tương ứng với từng bài tập.

- **Dev 4 (Operation Dev):**
  - Viết API **Classes**: Giảng viên tạo lớp học, thêm/xóa sinh viên vào lớp.
  - Viết API **Preferences**: Lưu cài đặt giao diện sáng/tối, bài tập yêu thích (Favorites), danh sách tùy chọn (Custom lists).
  - Viết API **Notifications**: Lấy danh sách thông báo, đếm số chưa đọc, đánh dấu đã đọc.

- **Dev 5 (DevOps & QA):**
  - Xây dựng `Dockerfile` và `docker-compose.yml` gồm: `php:8.2-fpm` (đã nạp sẵn driver `msodbcsql18` và `pdo_sqlsrv`), `nginx`, `mysql:8.0`.
  - Xuất file Postman Collection chứa toàn bộ các API mẫu từ backend Python hiện tại để làm thước đo kiểm thử (Ground Truth).

---

#### 📅 TUẦN 2: Core Engine Sandbox & Nghiệp vụ thi cử

- **Dev 1 (Lead):**
  - Viết API quản lý Người dùng cho Quản trị viên (`/api/admin/users/*`): Danh sách user, kích hoạt/vô hiệu hóa, đổi quyền.
  - Viết API Phê duyệt tài khoản Giảng viên (`/api/admin/users/approvals`).
  - Giám sát, code review và đảm bảo các định dạng JSON trả về khớp 100% với Frontend React.

- **Dev 2 (Engine Dev - Nhiệm vụ then chốt):**
  - Chuyển đổi toàn bộ Router `contest_exam.py` sang Controller PHP:
    1. `setup_contest_db`: Tự động cấp schema cá nhân trên SQL Server.
    2. `run_contest_ddl`: Thực thi script tạo bảng, bắt lỗi cú pháp T-SQL.
    3. `seed_contest_dml`: Nạp dữ liệu mẫu của giảng viên vào schema sinh viên.
    4. `inspect_contest_schema`: Truy vấn `sys.tables`, `sys.columns`, `sys.foreign_keys` để vẽ sơ đồ quan hệ ERD trả về cho giao diện thi.
    5. `run_contest_query`: Chạy thử query của thí sinh và trả về bảng dòng/cột.
  - Chuyển đổi **Bộ chấm toàn diện (`contest_grading.py`)** sang PHP: So sánh cấu trúc DDL, chấm tính toàn vẹn DML, chạy đối chiếu kết quả câu truy vấn SQL với đáp án của giảng viên.

- **Dev 3 (Content Dev):**
  - Viết API **Assignments**: Giảng viên tạo bài tập về nhà, cài đặt deadline, gán bài tập vào lớp học.
  - Viết API cho Sinh viên làm bài tập: Xem danh sách bài tập của lớp, nạp kết quả làm bài.

- **Dev 4 (Operation Dev):**
  - Viết API **Contests**: Tạo kỳ thi toàn diện, cấu hình điểm DDL/DML/SQL, gán script DDL chuẩn và script DML mẫu.
  - Viết API **Submissions**: Lưu lịch sử nộp bài, xem chi tiết bảng điểm Scorecard, API chấm bài thủ công (Review) dành cho Giảng viên.
  - Viết API **Dashboard**: Thống kê số bài đã làm, biểu đồ hoạt động (activity graph), streak học tập của sinh viên.

- **Dev 5 (DevOps & QA):**
  - Viết Unit Test và Feature Test (PHPUnit / Pest) kiểm thử tính đúng đắn của logic chấm thi DDL/DML/SQL.
  - Kiểm tra tính tương thích giữa API PHP mới và giao diện Frontend React (kiểm tra CORS, token headers, định dạng ngày tháng ISO 8601).

---

#### 📅 TUẦN 3: Ghép nối toàn diện, Kiểm thử tải & Bàn giao Go-Live

- **Ngày 1 - 2: Ghép nối Frontend React (Integration)**
  - Cấu hình URL endpoint của Frontend React trỏ sang server Backend PHP mới.
  - 5 thành viên cùng tham gia kiểm thử luồng từ đầu đến cuối (End-to-End):
    - Đăng ký giảng viên $\rightarrow$ Admin duyệt $\rightarrow$ Giảng viên tạo đề thi toàn diện $\rightarrow$ Sinh viên vào thi $\rightarrow$ Tạo bảng DDL $\rightarrow$ Nạp DML $\rightarrow$ Chạy truy vấn $\rightarrow$ Nộp bài và nhận Scorecard.

- **Ngày 3: Data Migration & Đồng bộ CSDL**
  - Dev 1 & Dev 4 viết script trích xuất dữ liệu cũ từ hệ thống hiện tại sang các bảng mới trên MySQL (chuyển các tài khoản user, danh sách bài tập đã tạo, lịch sử bài nộp).

- **Ngày 4: Kiểm thử chịu tải (Stress Testing - 1.000 sinh viên)**
  - Dev 2 & Dev 5 dùng công cụ **JMeter / k6** mô phỏng kịch bản phòng thi:
    - 500 - 1.000 sinh viên cùng gửi request đăng nhập, tạo schema trên SQL Server và nộp bài thi cùng lúc.
    - Tinh chỉnh cấu hình: `pm.max_children` của PHP-FPM, connection pool của SQL Server, và cấu hình Redis Queue nếu cần chấm điểm bất đồng bộ.

- **Ngày 5: Diễn tập & Chuyển giao hệ thống (Go-Live)**
  - Tổ chức một buổi thi thử nội bộ 30 phút.
  - Bàn giao tài liệu API và mã nguồn mới hoàn tất.

---

### 4. Checklist phòng tránh rủi ro kỹ thuật

1. **Rủi ro Driver SQL Server trên Linux:** Cần cấu hình và test driver `pdo_sqlsrv` ngay ngày đầu tiên của Tuần 1. Nếu gặp trục trặc hệ điều hành, dùng sẵn base image Docker `mcr.microsoft.com/mssql-tools` kết hợp PHP.
2. **Khớp cấu trúc JSON của Frontend:** Giữ nguyên quy ước đặt tên (CamelCase vs SnakeCase). Ví dụ Frontend đang nhận `{ "tableCount": 4, "schemaName": "..." }`, Controller PHP phải trả về đúng key đó để không phải sửa lại code React.
3. **Mã hóa mật khẩu tương thích:** Đảm bảo hàm hash mật khẩu của PHP (`password_hash($pass, PASSWORD_BCRYPT)`) tương thích với chuẩn `bcrypt` cũ của Python để người dùng cũ không bị mất mật khẩu khi đăng nhập.

Lộ trình trên **SONG SONG HÓA ĐƯỢC RẤT NHIỀU (lên tới 75 - 80%)** chứ **KHÔNG PHẢI CHẠY TUẦN TỰ**.

Lý do lớn nhất là chúng ta **đã có sẵn hệ thống Backend Python đang chạy làm chuẩn (Ground Truth)**. Toàn bộ cấu trúc bảng, tên API, input/output JSON đều đã có sẵn trong Swagger (`/docs`), nên các thành viên **không cần phải họp bàn thiết kế lại từ đầu hay chờ đợi nhau**.

Dưới đây là phân tích chi tiết về **Các luồng chạy song song** và **Một vài điểm nghẽn tuần tự bắt buộc**:

---

### 1. Sơ đồ 4 Luồng chạy Song song Độc lập (Parallel Streams)

Ngay từ Ngày 2 của Tuần 1, sau khi Dev 1 chốt xong file Migration tạo bảng, **4 luồng công việc hoàn toàn có thể chạy song song 100%**:

```
[NGÀY 1] ─── Chốt Migration MySQL & Docker Base (Dev 1 + Dev 5)
                      │
   ┌──────────────────┼──────────────────┬──────────────────┐
   ▼                  ▼                  ▼                  ▼
[LUỒNG 1: ENGINE]  [LUỒNG 2: ACADEMIC] [LUỒNG 3: OPERATION][LUỒNG 4: QA/DEVOPS]
(Dev 2 phụ trách)  (Dev 3 phụ trách)   (Dev 4 phụ trách)   (Dev 5 phụ trách)
 • Viết kết nối     • Code CRUD         • Code CRUD Classes • Viết Postman Test
   SQL Server         Problems            Notifications       tự động
 • Query Rewriter   • Test cases        • Preferences       • Dựng Mock data
 • Schema Inspector • Assignments       • Submissions       • Setup CI/CD
 • Chấm DDL/DML/SQL • Bài tập SV        • Dashboard         • Chuẩn bị k6 test
   │                  │                  │                  │
   └──────────────────┼──────────────────┴──────────────────┘
                      ▼
[TUẦN 3] ─── Ghép nối toàn bộ (Integration) & Stress Test 1.000 SV
```

#### Chi tiết tính độc lập của từng luồng:

- **Luồng 1 (Dev 2 - Engine Chấm thi): Độc lập 100% với MySQL!**
  Dev 2 chỉ làm việc trực tiếp với **SQL Server**, viết các thuật toán chuyển đổi query, inspect schema (`sys.tables`, `sys.columns`) và thuật toán so sánh điểm DDL/DML. Dev 2 có thể code và test xong toàn bộ module này bằng các script test riêng mà **không cần đợi** các bảng User hay Class bên MySQL xong.
- **Luồng 2 (Dev 3 - Ngân hàng đề & Bài tập): Độc lập với Luồng 1 & Luồng 3.**
  Chỉ tập trung vào CRUD các bảng `problems`, `test_cases`, `assignments` trên MySQL.
- **Luồng 3 (Dev 4 - Lớp học, Dashboard, Lịch sử nộp):**
  Chỉ tập trung vào các bảng `classes`, `submissions`, `notifications`, `preferences`.
- **Luồng 4 (Dev 5 - QA & DevOps):**
  Dựa vào Swagger của backend Python cũ để viết trước bộ test tự động (Postman Collection / Pest PHP). Khi Dev 2, 3, 4 code xong API nào thì Dev 5 bấm test API đó ngay.

---

### 2. Điểm nào BẮT BUỘC phải làm tuần tự? (Dependencies)

Trong toàn bộ dự án, chỉ có **2 điểm nút bắt buộc phải tuần tự**:

1. **Điểm nút 1 (1 - 2 ngày đầu tiên):**
   - **Bắt buộc tuần tự:** Dev 1 phải tạo xong khung dự án Laravel, file Migration cấu trúc các bảng MySQL (`users`, `problems`, `contests`...) và đẩy lên Git.
   - **Lý do:** Các thành viên khác cần cấu trúc bảng chung để viết Model Eloquent và thiết lập Foreign Key, tránh việc mỗi người tạo một kiểu gây xung đột (conflict).
2. **Điểm nút 2 (Tuần 3 - Ghép nối & Test tải):**
   - **Bắt buộc tuần tự:** Chỉ khi cả 3 luồng (Auth, CRUD Nghiệp vụ, Engine SQL Server) hoàn tất, cả đội mới có thể trỏ React Frontend sang và chạy bài kiểm tra chịu tải 1.000 sinh viên (Stress Test).

---

### 3. Bí quyết để 5 người chạy song song mà không bị "đụng hàng" (Conflict)

1. **Tuân thủ tuyệt đối API Contract cũ:**
   - Vì Frontend React đang chạy rất mượt với Backend Python, nên các Dev khi viết Controller PHP **phải giữ nguyên 100% tên trường JSON** (ví dụ: `tableCount`, `rowCount`, `ddlScript` thay vì tự ý đổi sang `table_count`, `row_count`).
2. **Phân chia Route rõ ràng theo File:**
   - Trong Laravel, chia routes thành các file riêng để tránh xung đột Git khi merge:
     - `routes/auth.php` (Dev 1)
     - `routes/contest_exam.php` (Dev 2)
     - `routes/academic.php` (Dev 3)
     - `routes/operations.php` (Dev 4)
3. **Tận dụng lợi thế "Có sẵn đáp án":**
   - Nếu không biết câu lệnh SQL inspect schema hay thuật toán chấm DDL viết như thế nào trên PHP, Dev 2 chỉ cần mở file `backend/app/services/contest_grading.py` và `backend/app/routers/contest_exam.py` là có sẵn 100% logic để dịch sang PHP.

> 💡 **Kết luận:** Nếu tận dụng triệt để tính song song này, đội ngũ 5 người hoàn toàn có thể **hoàn thành toàn bộ code chức năng chỉ trong 10 - 12 ngày làm việc**, dành trọn vẹn tuần cuối cùng cho việc tối ưu hiệu năng và test tải phòng thi thực tế!
