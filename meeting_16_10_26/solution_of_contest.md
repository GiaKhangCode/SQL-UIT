Dưới đây là **tổng kết toàn bộ giải pháp kỹ thuật tạo Database cá nhân cho sinh viên** mà chúng ta đã thiết kế và triển khai thành công trên hệ thống:

---

### 1. Bối cảnh & Thách thức ban đầu

- **Yêu cầu thực tế**: Phục vụ **1.000 sinh viên thi đồng thời** môn CSDL. Bài thi gồm 3 phần:
  1. **DDL**: Thí sinh tự tạo bảng, sửa cột, đặt khóa chính (PK), khóa ngoại (FK).
  2. **DML**: Nạp dữ liệu mẫu của giảng viên vào database vừa tạo.
  3. **SQL**: Viết các câu truy vấn trên chính database có dữ liệu đó.
- **Vấn đề nếu dùng giải pháp vật lý thông thường**:
  - Nếu mỗi sinh viên tạo 1 database riêng (`CREATE DATABASE db_...` trên Azure SQL/SQL Server), hệ thống sẽ mất **30 – 60 giây/database**, dễ vượt giới hạn database và chi phí đám mây đội lên cực lớn.

---

### 2. Giải pháp cốt lõi: Schema-Level Multi-Tenancy (Phân vùng theo Schema)

Thay vì tạo 1.000 database vật lý riêng biệt, hệ thống dùng **1 Database tập trung nhưng phân vùng thành hàng ngàn Schema độc lập**:

```
                       AZURE SQL DATABASE (Production)
                                      │
  ┌───────────────────────────────────┼───────────────────────────────────┐
  │                                   │                                   │
SCHEMA:                             SCHEMA:                             SCHEMA:
[c_contest1_sv01]                   [c_contest1_sv02]                   [c_contest2_sv01]
├── Table: KHACHHANG                ├── Table: KHACHHANG                ├── Table: SINHVIEN
├── Table: HOADON                   ├── Table: HOADON                   ├── Table: MONHOC
└── Table: CTHD                     └── Table: CTHD                     └── Table: KETQUA
(Cô lập 100% với sv khác)           (Cô lập 100% với sv khác)           (Kỳ thi khác, độc lập)
```

- **Quy tắc đặt tên**: `c_[Mã_Kỳ_Thi]_[Mã_Sinh_Viên]` (Ví dụ: `c_01b1d220_6b8f1cca`).
- **Tốc độ tạo**: Lệnh `CREATE SCHEMA` chỉ mất **0.01 giây** và **hoàn toàn miễn phí**, không làm quá tải server.
- **Tính bền vững**:
  - Schema **chỉ tạo 1 lần duy nhất** khi sinh viên bước vào kỳ thi.
  - Sinh viên F5, rớt mạng hoặc đổi máy thì toàn bộ bảng và dữ liệu đã tạo **vẫn được bảo toàn nguyên vẹn 100%**.

---

### 3. Cơ chế Viết lại Truy vấn Trong Suốt (Transparent SQL Rewriter)

Sinh viên hoàn toàn **không cần biết tên schema của mình**, họ viết SQL tự nhiên như đang dùng máy local:

- Sinh viên viết:
  ```sql
  CREATE TABLE KHACHHANG (MAKH VARCHAR(10) PRIMARY KEY, HOTEN NVARCHAR(100));
  SELECT * FROM KHACHHANG;
  ```
- Backend tự động phân tích và viết lại trước khi đẩy vào SQL Server:
  ```sql
  CREATE TABLE [c_01b1d220_6b8f1cca].[KHACHHANG] (MAKH VARCHAR(10) PRIMARY KEY, HOTEN NVARCHAR(100));
  SELECT * FROM [c_01b1d220_6b8f1cca].[KHACHHANG];
  ```
  $\rightarrow$ Sinh viên A và sinh viên B cùng tạo bảng `KHACHHANG` nhưng nằm ở 2 vùng schema khác nhau, hoàn toàn không xung đột hay đè dữ liệu của nhau.

---

### 4. Máy chấm thi Tự động 3 Giai đoạn (Comprehensive Grading Engine)

Hệ thống chấm độc lập và minh bạch theo 3 bước:

1. **Chấm DDL (30 điểm)**:
   - Hệ thống chạy DDL chuẩn của giảng viên trên một schema tham chiếu tạm.
   - Dùng `INFORMATION_SCHEMA.TABLES`, `COLUMNS`, `sys.key_constraints` và `sys.foreign_keys` để bóc tách siêu dữ liệu (metadata) của cả 2 bên.
   - Đối chiếu: Tên bảng, danh sách cột, kiểu dữ liệu (`INT`, `VARCHAR`, `NVARCHAR`), độ dài cột, cờ `NOT NULL`, **Khóa chính (PK)** và **Khóa ngoại (FK)** $\rightarrow$ Tính điểm chi tiết.
2. **Chấm DML (20 điểm)**:
   - Thực thi Seed Script của giảng viên vào CSDL của thí sinh.
   - Nếu DDL của thí sinh thiếu bảng, thiếu cột hoặc sai kiểu khóa ngoại $\rightarrow$ SQL Server sẽ báo lỗi chính xác vị trí sai, giúp thí sinh biết và quay lại sửa DDL.
   - Đạt trọn điểm nếu nạp đủ số dòng vào toàn bộ các bảng.
3. **Chấm SQL Queries (50 điểm)**:
   - Lấy từng câu hỏi truy vấn, chạy câu lệnh của thí sinh và câu lệnh đáp án chuẩn của giảng viên trên chính CSDL đã nạp dữ liệu.
   - So khớp bảng kết quả trả về (cột, giá trị các dòng và thứ tự sắp xếp).

---

### 5. Khả năng Chịu tải 1.000 Thí sinh Đồng thời

- **Connection Pool**: Cấu hình `pool_size=50`, `max_overflow=50`, `pool_timeout=30s` (hỗ trợ tới 100 kết nối truy vấn song song cùng lúc vào Azure SQL).
- **Hàng đợi Bất đồng bộ (Async Submission Queue)**:
  - Khi 1.000 sinh viên đồng loạt bấm nộp bài thi ở phút cuối, yêu cầu nộp bài sẽ được xếp vào hàng đợi máy chấm.
  - 15 tác vụ worker nền chạy song song lấy bài ra chấm mà không làm nghẽn API hay sập máy chủ.
  - Phía sinh viên hiển thị trạng thái _"Đang đợi trong hàng đợi... (Vị trí số X)"_ và tự động nhận bảng điểm khi chấm xong.

---

### 6. Giao diện Thí sinh (3-Stage Exam Workspace)

- **Tab 1 - DDL**: Soạn thảo code + **Live Schema Inspector** hiển thị cây thư mục các bảng, cột, icon Khóa chính 🔑, Khóa ngoại 🔗 và số dòng.
- **Tab 2 - DML**: Xem trước script dữ liệu mẫu và bấm _"🚀 Nạp dữ liệu vào Database"_.
- **Tab 3 - SQL Queries**: Danh sách câu hỏi, đề bài Markdown, soạn thảo truy vấn + nút _"▶ Chạy thử truy vấn"_ xem dữ liệu thực tế.
- **Scorecard Modal**: Bảng điểm tổng kết chi tiết từng phần ngay sau khi nộp bài.
