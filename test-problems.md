# Bài mẫu kiểm thử iSQL

Các bài mẫu SQL Server để nhập trong **Problems → New problem**. Hãy đổi số nếu các số mẫu đã được dùng.

## Chọn chế độ trong Assignment/Contest

New problem chỉ tạo và lưu nội dung bài, cấu trúc CSDL, dataset và lời giải; không chọn chế độ làm bài ở trang này. Chế độ được cấu hình riêng trong **New Assignment** hoặc **New Contest**: thêm bài từ thư viện, sau đó chọn các checkbox **Table Design (DDL)**, **Data Import (DML)** và **Query (SQL)** tại từng bài trong bảng Problems & points. Cùng một problem có thể được dùng với các tổ hợp chế độ khác nhau ở những Assignment/Contest khác nhau.

- Bài 1: trong Assignment/Contest, chỉ chọn SQL.
- Bài 2: trong Assignment/Contest, chỉ chọn DDL.
- Bài 3: trong Assignment/Contest, chọn DDL + DML + SQL.

Trong từng bài, nhập Statement/Requirements ở Problem content, DDL ở Database structure, các câu INSERT khởi tạo ở Test datasets, và truy vấn đáp án ở SQL Solution. Bài 1 có hai dataset; đánh dấu dataset thứ hai là **Hidden dataset**. Chạy lời giải thành công qua tất cả dataset sẽ tự cập nhật **Kết quả đầu ra mong đợi** ở cuối đề; nhấn **Preview** để xem ngay trước khi lưu. **Hidden dataset** ở từng kết quả query được đồng bộ với tab dữ liệu: ẩn cả dữ liệu mẫu và đầu ra của dataset đó khỏi sinh viên, đồng thời vẫn giữ đáp án để chấm bài. **Hide expected output** ẩn toàn bộ bảng đầu ra, còn dữ liệu mẫu vẫn tuân theo từng nút Hidden dataset.

---

## Bài 1 — Tổng chi tiêu theo khách hàng

**Số:** 247

**Độ khó:** Easy

**Chọn trong Assignment/Contest:** chỉ SQL

**Title:** `Tổng chi tiêu theo khách hàng`

**Statement**

```text
Cho biết số đơn hàng và tổng số tiền đã chi của từng khách hàng. Kết quả phải bao gồm cả khách hàng chưa từng đặt hàng.
```

**Requirements**

```text
Trả về CustomerId, FullName, OrderCount và TotalSpent. Sắp xếp tăng dần theo CustomerId. Khách chưa có đơn phải có OrderCount = 0 và TotalSpent = 0.
```

**Database structure — `database.sql`**

```sql
CREATE TABLE Customers (
    CustomerId INT NOT NULL PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL
);

CREATE TABLE Orders (
    OrderId INT NOT NULL PRIMARY KEY,
    CustomerId INT NOT NULL,
    TotalAmount DECIMAL(12, 2) NOT NULL,
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerId)
        REFERENCES Customers(CustomerId)
);
```

**Test dataset 1 — `seed_1.sql`** (hiện cho sinh viên)

```sql
INSERT INTO Customers (CustomerId, FullName)
VALUES (1, N'Nguyễn An'), (2, N'Trần Bình'), (3, N'Lê Chi');

INSERT INTO Orders (OrderId, CustomerId, TotalAmount)
VALUES (101, 1, 120000), (102, 1, 80000), (103, 2, 250000);
```

Kết quả mong đợi: `1 | Nguyễn An | 2 | 200000.00`, `2 | Trần Bình | 1 | 250000.00`, `3 | Lê Chi | 0 | 0.00`.

**Test dataset 2 — `seed_2.sql`** (đánh dấu Hidden dataset)

```sql
INSERT INTO Customers (CustomerId, FullName)
VALUES (10, N'Nguyễn Dũng'), (20, N'Lê Em');

INSERT INTO Orders (OrderId, CustomerId, TotalAmount)
VALUES (1001, 10, 90000), (1002, 10, 60000), (1003, 20, 0);
```

Kết quả mong đợi: `10 | Nguyễn Dũng | 2 | 150000.00`, `20 | Lê Em | 1 | 0.00`.

**SQL Solution — `solution_1.sql`**

```sql
SELECT
    c.CustomerId,
    c.FullName,
    COUNT(o.OrderId) AS OrderCount,
    CAST(COALESCE(SUM(o.TotalAmount), 0) AS DECIMAL(12, 2)) AS TotalSpent
FROM Customers AS c
LEFT JOIN Orders AS o ON o.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName
ORDER BY c.CustomerId;
```

Thử LEFT JOIN, tổng hợp, khách chưa có đơn, dataset ẩn và tính năng lưu/ẩn expected output.

---

## Bài 2 — Thiết kế CSDL nhân sự

**Số:** 248

**Độ khó:** Medium

**Chọn trong Assignment/Contest:** chỉ DDL

**Title:** `Thiết kế CSDL nhân sự`

**Statement**

```text
Tạo cấu trúc dữ liệu lưu phòng ban và nhân viên. Mỗi nhân viên thuộc về một phòng ban đã tồn tại.
```

**Requirements**

```text
Tạo hai bảng Departments và Employees. Departments gồm DeptId và DeptName. Employees gồm EmployeeId, FullName và DeptId. Đặt khóa chính cho mã của mỗi bảng và khóa ngoại Employees.DeptId tham chiếu Departments.DeptId. Tên phòng ban và tên nhân viên không được để trống.
```

**Database structure — `database.sql`** (script tham chiếu)

```sql
CREATE TABLE Departments (
    DeptId INT NOT NULL PRIMARY KEY,
    DeptName NVARCHAR(80) NOT NULL
);

CREATE TABLE Employees (
    EmployeeId INT NOT NULL PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    DeptId INT NOT NULL,
    CONSTRAINT FK_Employees_Departments FOREIGN KEY (DeptId)
        REFERENCES Departments(DeptId)
);
```

Không cần dataset. Trong Assignment/Contest, chỉ bật DDL. Dùng bài này để thử chạy DDL, xem sơ đồ bảng/khóa/quan hệ và luồng nộp bài chờ giảng viên xem.

---

## Bài 3 — Quản lý đăng ký môn học

**Số:** 249

**Độ khó:** Medium

**Chọn trong Assignment/Contest:** DDL + DML + SQL

**Title:** `Quản lý đăng ký môn học`

**Statement**

```text
Hoàn thiện cơ sở dữ liệu đăng ký môn học, cập nhật đăng ký theo yêu cầu và thống kê kết quả hoàn thành của từng môn.
```

**Requirements**

```text
Ở phần DDL, tạo các bảng Students, Courses và Enrollments đúng theo cấu trúc tham chiếu, gồm khóa chính và khóa ngoại.

Ở phần DML, thêm đăng ký có EnrollmentId = 1004 cho sinh viên 1 vào môn 20 với trạng thái Registered và Score để trống. Sau đó cập nhật đăng ký 1002 thành Completed với Score = 6.50.

Ở phần SQL, trả về CourseId, CourseName, CompletedCount và AverageScore. Chỉ tính điểm của đăng ký có trạng thái Completed; sắp xếp tăng dần theo CourseId.
```

**Database structure — `database.sql`**

```sql
CREATE TABLE Students (
    StudentId INT NOT NULL PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL
);

CREATE TABLE Courses (
    CourseId INT NOT NULL PRIMARY KEY,
    CourseName NVARCHAR(120) NOT NULL
);

CREATE TABLE Enrollments (
    EnrollmentId INT NOT NULL PRIMARY KEY,
    StudentId INT NOT NULL,
    CourseId INT NOT NULL,
    Score DECIMAL(4, 2) NULL,
    Status NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_Enrollments_Students FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId),
    CONSTRAINT FK_Enrollments_Courses FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
);
```

**Test dataset 1 — `seed_1.sql`**

```sql
INSERT INTO Students (StudentId, FullName)
VALUES (1, N'Nguyễn An'), (2, N'Trần Bình'), (3, N'Lê Chi');

INSERT INTO Courses (CourseId, CourseName)
VALUES (10, N'SQL cơ bản'), (20, N'Thiết kế cơ sở dữ liệu');

INSERT INTO Enrollments (EnrollmentId, StudentId, CourseId, Score, Status)
VALUES
    (1001, 1, 10, 8.50, N'Completed'),
    (1002, 2, 10, NULL, N'Registered'),
    (1003, 3, 20, 7.00, N'Completed');
```

**DML tham khảo để chạy trong workspace**

```sql
INSERT INTO Enrollments (EnrollmentId, StudentId, CourseId, Score, Status)
VALUES (1004, 1, 20, NULL, N'Registered');

UPDATE Enrollments
SET Status = N'Completed', Score = 6.50
WHERE EnrollmentId = 1002;
```

Sau khi chạy DML, Enrollments phải có bốn dòng; dòng 1002 có trạng thái Completed, điểm 6.50; dòng 1004 có trạng thái Registered, điểm NULL.

**SQL Solution — `solution_1.sql`**

```sql
SELECT
    c.CourseId,
    c.CourseName,
    COUNT(CASE WHEN e.Status = N'Completed' THEN 1 END) AS CompletedCount,
    CAST(AVG(CASE WHEN e.Status = N'Completed' THEN e.Score END) AS DECIMAL(4, 2)) AS AverageScore
FROM Courses AS c
LEFT JOIN Enrollments AS e ON e.CourseId = c.CourseId
GROUP BY c.CourseId, c.CourseName
ORDER BY c.CourseId;
```

Sau khi chạy cả DML tham khảo và SQL Solution, kết quả là `10 | SQL cơ bản | 2 | 7.50` và `20 | Thiết kế cơ sở dữ liệu | 1 | 7.00`.

Thử ba tab Description/Database/Submission, DDL kèm sơ đồ, DML và preview bảng sau khi chạy, SQL, Submit riêng từng phần, chế độ chỉ xem sau khi nộp, **Edit again**, và Exit khi còn thay đổi chưa nộp. Nếu chạy lại DML từ đầu, reset workspace trước vì khóa chính 1004 đã được thêm.

---

## Checklist Submit/Exit

1. Mở bài ở vai trò sinh viên và xác nhận tab **Submission** luôn xuất hiện.
2. Sửa code rồi nhấn **Exit** trước khi nộp; xác nhận hộp thoại cảnh báo và chọn ở lại.
3. Nhấn **Submit**; xác nhận vẫn ở workspace, code chuyển thành chỉ xem và Submission hiện bài vừa nộp.
4. Nhấn **Edit again**, sửa code, rồi nhấn **Exit** để kiểm tra cảnh báo thay đổi chưa nộp.
5. Lặp lại với DDL/DML ở bài 3. Thử DDL sai cú pháp và chạy DML hai lần để kiểm tra lỗi khóa chính trùng.
