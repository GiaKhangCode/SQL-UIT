Điều này **HOÀN TOÀN KHẢ THI** và thậm chí là **MỘT KIẾN TRÚC RẤT CHUẨN** (Decoupled Architecture - Tách biệt dữ liệu nghiệp vụ và môi trường thực thi).

Các nền tảng chấm bài lớn như LeetCode hay HackerRank cũng đều dùng mô hình này: Một CSDL quản lý ứng dụng riêng, và một môi trường chuyên để chạy code/truy vấn của người dùng riêng.

---

### 1. Sơ đồ kiến trúc khi chuyển đổi

```
                       [React Frontend]
                              │
                              ▼
                [PHP Backend (Laravel / Symfony)]
                 (Xử lý Auth, RBAC, CRUD, API)
                  │                           │
         (1) Lưu trữ nghiệp vụ          (2) Chấm & Sandbox
                  │                           │
                  ▼                           ▼
        [MySQL Database]              [SQL Server (Azure / VPS)]
   - Users (Sinh viên, GV)        - Schema cá nhân của từng SV
   - Classes, Assignments         - Chạy CREATE TABLE (DDL)
   - Problems, Test cases         - Nạp dữ liệu mẫu (DML)
   - Điểm số & Submissions        - Chạy câu truy vấn SQL
```

---

### 2. Cách PHP kết nối song song 2 Cơ sở dữ liệu

Nếu bạn dùng **PHP (đặc biệt là Laravel)**, việc kết nối đa cơ sở dữ liệu (Multi-Database Connection) được hỗ trợ mặc định và rất dễ dàng:

Trong file cấu hình `config/database.php`:

- **Connection 1 (`mysql` - Mặc định):** Kết nối tới MySQL để chạy các Model Eloquent (`User`, `Problem`, `Contest`, `Submission`).
- **Connection 2 (`sqlsrv`):** Sử dụng driver chính thức của Microsoft là **`pdo_sqlsrv`**. Khi sinh viên chạy DDL/DML/Query hoặc khi chấm bài, PHP chỉ việc gọi:
  ```php
  // Chạy câu lệnh trên SQL Server của sinh viên
  $results = DB::connection('sqlsrv')->select($rewrittenQuery);
  ```

---

### 3. Ưu điểm vượt trội của mô hình này

1. **Tách biệt rủi ro hoàn toàn (Fault Isolation):**
   - Trong lúc thi, nếu sinh viên viết lệnh SQL bị vòng lặp vô tận, khóa bảng (deadlock) hoặc làm treo SQL Server $\rightarrow$ **Hệ thống web chính (PHP + MySQL) vẫn hoạt động 100% bình thường**. Sinh viên không bị văng khỏi web, Giảng viên vẫn xem được danh sách.
2. **Tiết kiệm chi phí vận hành:**
   - MySQL cực kỳ nhẹ, miễn phí và tối ưu cho dữ liệu web nghiệp vụ.
   - Bạn không phải trả tiền bản quyền hay tài nguyên RAM đắt đỏ của SQL Server để lưu trữ những thông tin cơ bản như người dùng, tin nhắn hay thông báo.
3. **Frontend gần như không cần sửa:**
   - Vì Frontend giao tiếp qua chuẩn RESTful API (JSON), nên khi bạn viết lại Backend bằng PHP, bạn chỉ cần giữ nguyên các endpoint URL và cấu trúc JSON trả về thì toàn bộ giao diện React hiện tại sẽ hoạt động ngay mà không phải làm lại.

---

### 4. Những điểm cần lưu ý khi bắt tay vào làm

- **Cài đặt Driver trên Server:** Nếu triển khai PHP trên máy chủ Linux/Docker (Ubuntu/Debian), bạn cần cài thêm package **`msodbcsql18`** của Microsoft và kích hoạt extension **`pdo_sqlsrv`** cho PHP để PHP có thể nói chuyện được với SQL Server.
- **Xử lý đồng thời (Queue Worker):** Khi có hàng trăm sinh viên cùng nhấn nộp bài một lúc, PHP nên sử dụng Queue (Redis + Laravel Worker) để xử lý việc chấm điểm ngầm, giúp phản hồi ngay cho sinh viên mà không bị timeout request.
