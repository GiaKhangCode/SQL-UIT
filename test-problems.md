# Bài mẫu kiểm thử iSQL

Các bài mẫu SQL Server để nhập trong **Problems → New problem**. Hãy đổi số nếu các số mẫu đã được dùng.

## Chọn chế độ trong Assignment/Contest

New problem chỉ tạo và lưu nội dung bài, cấu trúc CSDL, dataset và lời giải; không chọn chế độ làm bài ở trang này. Chế độ được cấu hình riêng trong **New Assignment** hoặc **New Contest**: thêm bài từ thư viện, sau đó chọn các checkbox **Table Design (DDL)**, **Data Import (DML)** và **Query (SQL)** tại từng bài trong bảng Problems & points. Cùng một problem có thể được dùng với các tổ hợp chế độ khác nhau ở những Assignment/Contest khác nhau.

- Bài 1: trong Assignment/Contest, chỉ chọn SQL.
- Bài 2: trong Assignment/Contest, chỉ chọn DDL.
- Bài 3: trong Assignment/Contest, chọn DDL + DML + SQL.
- Bài 4: trong Assignment/Contest, chỉ chọn DML.
- Bài 5: trong Assignment/Contest, chỉ chọn SQL.
- Bài 6: bộ Quản lý bán hàng từ PDF, gồm query 6.1-6.44 dùng chung một database.

Cả 6 bộ bài đều có đủ cấu trúc bảng, dataset và SQL Solution để giảng viên nhập ở New problem. Các chế độ dưới đây chỉ là gợi ý kiểm thử khi đưa bài vào Assignment/Contest.

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
Tạo cấu trúc dữ liệu lưu phòng ban và nhân viên. Mỗi nhân viên thuộc về một phòng ban đã tồn tại. Hệ thống sẽ nạp dữ liệu và chạy truy vấn thống kê số nhân viên theo phòng ban để kiểm tra cấu trúc của bạn.
```

**Requirements**

```text
Tạo hai bảng Departments và Employees:
- Departments: DeptId INT NOT NULL là khóa chính; DeptName NVARCHAR(80) NOT NULL.
- Employees: EmployeeId INT NOT NULL là khóa chính; FullName NVARCHAR(100) NOT NULL; DeptId INT NOT NULL.
- Employees.DeptId là khóa ngoại tham chiếu Departments.DeptId.

Trong chế độ chỉ DDL, sinh viên chỉ cần viết script tạo bảng. Hệ thống tự dùng dataset và truy vấn đáp án của giảng viên để kiểm tra; sinh viên không cần nhập INSERT hoặc SELECT.
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

**Test dataset 1 — `seed_1.sql`** (hiện cho sinh viên)

```sql
INSERT INTO Departments (DeptId, DeptName)
VALUES (10, N'Kỹ thuật'), (20, N'Kế toán'), (30, N'Nhân sự');

INSERT INTO Employees (EmployeeId, FullName, DeptId)
VALUES
    (1, N'Nguyễn An', 10),
    (2, N'Trần Bình', 10),
    (3, N'Lê Chi', 20);
```

Kết quả đầu ra mong đợi:

| DeptId | DeptName | EmployeeCount |
| --- | --- | --- |
| 10 | Kỹ thuật | 2 |
| 20 | Kế toán | 1 |
| 30 | Nhân sự | 0 |

**Test dataset 2 — `seed_2.sql`** (đánh dấu Hidden dataset)

```sql
INSERT INTO Departments (DeptId, DeptName)
VALUES (1, N'Vận hành'), (2, N'Marketing');

INSERT INTO Employees (EmployeeId, FullName, DeptId)
VALUES (11, N'Phạm Dũng', 2), (12, N'Võ Em', 2);
```

Kết quả đầu ra mong đợi:

| DeptId | DeptName | EmployeeCount |
| --- | --- | --- |
| 1 | Vận hành | 0 |
| 2 | Marketing | 2 |

**SQL Solution — `solution_1.sql`**

```sql
SELECT
    d.DeptId,
    d.DeptName,
    COUNT(e.EmployeeId) AS EmployeeCount
FROM Departments AS d
LEFT JOIN Employees AS e ON e.DeptId = d.DeptId
GROUP BY d.DeptId, d.DeptName
ORDER BY d.DeptId;
```

Giảng viên chạy SQL Solution qua cả hai dataset để tạo đầu ra mong đợi trước khi lưu. Trong Assignment/Contest, chỉ bật DDL để thử chấm cấu trúc tự động, sơ đồ PK/FK và khả năng nạp dữ liệu giảng viên. Thử bỏ khóa ngoại hoặc đổi FullName thành NVARCHAR(50) để kiểm tra bài sai cấu trúc.

---

## Bài 3 — Quản lý đăng ký môn học

**Số:** 249

**Độ khó:** Medium

**Chọn trong Assignment/Contest:** DDL + DML + SQL

**Title:** `Quản lý đăng ký môn học`

**Statement**

```text
Hoàn thiện cơ sở dữ liệu đăng ký môn học, nhập bộ dữ liệu đích và thống kê kết quả hoàn thành của từng môn.
```

**Requirements**

```text
Ở phần DDL, tạo các bảng Students, Courses và Enrollments đúng theo cấu trúc tham chiếu, gồm khóa chính và khóa ngoại.

Ở phần DML, dùng INSERT để nhập toàn bộ bộ dữ liệu đích trong Test dataset 1 vào các bảng rỗng. Nhập Students và Courses trước Enrollments để đáp ứng khóa ngoại. Dòng 1002 phải có trạng thái Completed và Score = 6.50; dòng 1004 phải có trạng thái Registered và Score = NULL.

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
    (1002, 2, 10, 6.50, N'Completed'),
    (1003, 3, 20, 7.00, N'Completed'),
    (1004, 1, 20, NULL, N'Registered');
```

**DML tham khảo để chạy trong workspace:** dùng toàn bộ script Test dataset 1 ở trên. Chế độ có DML không tự nạp sẵn dataset giảng viên; sinh viên cần nhập tất cả các dòng bằng INSERT. Sau khi chạy, Students có ba dòng, Courses có hai dòng và Enrollments có bốn dòng.

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

Kết quả đầu ra mong đợi:

| CourseId | CourseName | CompletedCount | AverageScore |
| --- | --- | --- | --- |
| 10 | SQL cơ bản | 2 | 7.50 |
| 20 | Thiết kế cơ sở dữ liệu | 1 | 7.00 |

Giảng viên chạy SQL Solution trên dataset đã nhập để tạo đúng bảng này. Trong workspace sinh viên, dùng DDL ở trên, toàn bộ script Test dataset 1 ở phần DML và SQL Solution ở phần Query để thử một bài đúng hoàn chỉnh.

Thử ba tab Description/Database/Submission, DDL kèm sơ đồ, DML và preview bảng sau khi chạy, SQL, Submit toàn bộ các phần đã bật, chế độ chỉ xem sau khi nộp, **Edit again**, và Exit khi còn thay đổi chưa nộp. Mỗi lần Run dựng lại môi trường từ script hiện có; chạy lại cùng một script không cần reset. Để thử lỗi khóa chính trùng, thêm một INSERT lặp mã 1004 ngay trong cùng script DML.

---

## Bài 4 — Nạp dữ liệu tồn kho

**Số:** 250

**Độ khó:** Easy

**Chọn trong Assignment/Contest:** chỉ DML

**Title:** `Nạp dữ liệu tồn kho`

**Statement**

```text
Cấu trúc các bảng quản lý sản phẩm và biến động kho đã được tạo sẵn. Hãy nhập đầy đủ dữ liệu đích bằng INSERT để hệ thống xác nhận tồn kho và giá trị tồn kho của từng sản phẩm.
```

**Requirements**

```text
Chỉ dùng INSERT; không cần CREATE TABLE, UPDATE, DELETE hoặc SELECT để hoàn thành phần DML.

Nhập đầy đủ các dòng trong bộ dữ liệu mẫu vào Products và StockMovements. Nhập Products trước StockMovements để đáp ứng khóa ngoại. Quantity dương là nhập kho, Quantity âm là xuất kho.

Dữ liệu sau khi nhập phải có ba sản phẩm và ba dòng biến động kho. Sản phẩm không có biến động vẫn được giữ trong Products và có tồn kho bằng 0.
```

**Database structure — `database.sql`**

```sql
CREATE TABLE Products (
    ProductId INT NOT NULL PRIMARY KEY,
    ProductName NVARCHAR(100) NOT NULL,
    UnitPrice DECIMAL(12, 2) NOT NULL
);

CREATE TABLE StockMovements (
    MovementId INT NOT NULL PRIMARY KEY,
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_StockMovements_Products FOREIGN KEY (ProductId)
        REFERENCES Products(ProductId)
);
```

**Test dataset 1 — `seed_1.sql`** (hiện cho sinh viên; bộ dữ liệu đích của phần DML)

```sql
INSERT INTO Products (ProductId, ProductName, UnitPrice)
VALUES
    (1, N'Chuột máy tính', 150000),
    (2, N'Bàn phím', 450000),
    (3, N'Màn hình', 3200000);

INSERT INTO StockMovements (MovementId, ProductId, Quantity)
VALUES (101, 1, 10), (102, 1, -3), (103, 2, 5);
```

**SQL Solution — `solution_1.sql`**

```sql
SELECT
    p.ProductId,
    p.ProductName,
    COALESCE(SUM(m.Quantity), 0) AS StockQuantity,
    CAST(p.UnitPrice * COALESCE(SUM(m.Quantity), 0) AS DECIMAL(14, 2)) AS StockValue
FROM Products AS p
LEFT JOIN StockMovements AS m ON m.ProductId = p.ProductId
GROUP BY p.ProductId, p.ProductName, p.UnitPrice
ORDER BY p.ProductId;
```

Kết quả đầu ra mong đợi:

| ProductId | ProductName | StockQuantity | StockValue |
| --- | --- | --- | --- |
| 1 | Chuột máy tính | 7 | 1050000.00 |
| 2 | Bàn phím | 5 | 2250000.00 |
| 3 | Màn hình | 0 | 0.00 |

Giảng viên nhập đủ DDL, dataset và SQL Solution ở New problem, chạy query rồi lưu. Khi gán bài, chỉ bật DML. Sinh viên bắt đầu với cấu trúc bảng sẵn có nhưng chưa có dữ liệu; bài làm đúng là toàn bộ script Test dataset 1. Thử thiếu sản phẩm 3 hoặc đổi Quantity từ -3 thành -2 để kiểm tra chấm sai dữ liệu. Không đánh dấu dataset duy nhất là Hidden vì sinh viên cần nhìn thấy bộ dữ liệu đích để nhập.

---

## Bài 5 — Xếp hạng lương theo phòng ban

**Số:** 251

**Độ khó:** Hard

**Chọn trong Assignment/Contest:** chỉ SQL

**Title:** `Xếp hạng lương theo phòng ban`

**Statement**

```text
Tìm các nhân viên thuộc hai mức lương cao nhất của từng phòng ban. Nếu nhiều nhân viên có cùng mức lương thì họ cùng hạng và đều được đưa vào kết quả.
```

**Requirements**

```text
Trả về DeptId, DeptName, EmployeeId, FullName, Salary và SalaryRank.

Xếp hạng riêng trong từng phòng ban theo Salary giảm dần bằng DENSE_RANK; chỉ lấy SalaryRank <= 2. Loại nhân viên có Salary = NULL trước khi xếp hạng.

Phòng ban không có nhân viên có lương hợp lệ không xuất hiện trong kết quả. Sắp xếp theo DeptId tăng dần, SalaryRank tăng dần, rồi EmployeeId tăng dần. Không dùng TOP 2 cho toàn bộ bảng hoặc ROW_NUMBER để thay thế quy tắc đồng hạng.
```

**Database structure — `database.sql`**

```sql
CREATE TABLE Departments (
    DeptId INT NOT NULL PRIMARY KEY,
    DeptName NVARCHAR(80) NOT NULL
);

CREATE TABLE Employees (
    EmployeeId INT NOT NULL PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    DeptId INT NOT NULL,
    Salary DECIMAL(12, 2) NULL,
    CONSTRAINT FK_Employees_Departments FOREIGN KEY (DeptId)
        REFERENCES Departments(DeptId)
);
```

**Test dataset 1 — `seed_1.sql`** (hiện cho sinh viên)

```sql
INSERT INTO Departments (DeptId, DeptName)
VALUES (10, N'Kỹ thuật'), (20, N'Kinh doanh'), (30, N'Nhân sự');

INSERT INTO Employees (EmployeeId, FullName, DeptId, Salary)
VALUES
    (101, N'Nguyễn An', 10, 25000000),
    (102, N'Trần Bình', 10, 22000000),
    (103, N'Lê Chi', 10, 22000000),
    (104, N'Phạm Dũng', 10, 18000000),
    (201, N'Võ Em', 20, 20000000),
    (202, N'Đỗ Giang', 20, NULL),
    (203, N'Bùi Hà', 20, 17000000),
    (301, N'Mai Khang', 30, NULL);
```

Kết quả đầu ra mong đợi:

| DeptId | DeptName | EmployeeId | FullName | Salary | SalaryRank |
| --- | --- | --- | --- | --- | --- |
| 10 | Kỹ thuật | 101 | Nguyễn An | 25000000.00 | 1 |
| 10 | Kỹ thuật | 102 | Trần Bình | 22000000.00 | 2 |
| 10 | Kỹ thuật | 103 | Lê Chi | 22000000.00 | 2 |
| 20 | Kinh doanh | 201 | Võ Em | 20000000.00 | 1 |
| 20 | Kinh doanh | 203 | Bùi Hà | 17000000.00 | 2 |

**Test dataset 2 — `seed_2.sql`** (đánh dấu Hidden dataset)

```sql
INSERT INTO Departments (DeptId, DeptName)
VALUES (1, N'Vận hành'), (2, N'Tài chính'), (3, N'Pháp chế');

INSERT INTO Employees (EmployeeId, FullName, DeptId, Salary)
VALUES
    (11, N'Nguyễn Lan', 1, 12000000),
    (12, N'Trần Minh', 1, 12000000),
    (13, N'Lê Ngọc', 1, 11000000),
    (14, N'Phạm Oanh', 1, 10000000),
    (21, N'Võ Phúc', 2, 13000000),
    (22, N'Đỗ Quân', 2, NULL);
```

Kết quả đầu ra mong đợi:

| DeptId | DeptName | EmployeeId | FullName | Salary | SalaryRank |
| --- | --- | --- | --- | --- | --- |
| 1 | Vận hành | 11 | Nguyễn Lan | 12000000.00 | 1 |
| 1 | Vận hành | 12 | Trần Minh | 12000000.00 | 1 |
| 1 | Vận hành | 13 | Lê Ngọc | 11000000.00 | 2 |
| 2 | Tài chính | 21 | Võ Phúc | 13000000.00 | 1 |

**SQL Solution — `solution_1.sql`**

```sql
WITH RankedEmployees AS (
    SELECT
        d.DeptId,
        d.DeptName,
        e.EmployeeId,
        e.FullName,
        e.Salary,
        DENSE_RANK() OVER (
            PARTITION BY e.DeptId
            ORDER BY e.Salary DESC
        ) AS SalaryRank
    FROM Employees AS e
    INNER JOIN Departments AS d ON d.DeptId = e.DeptId
    WHERE e.Salary IS NOT NULL
)
SELECT DeptId, DeptName, EmployeeId, FullName, Salary, SalaryRank
FROM RankedEmployees
WHERE SalaryRank <= 2
ORDER BY DeptId, SalaryRank, EmployeeId;
```

Thử CTE, window function, đồng hạng, NULL, phòng ban rỗng và bộ test ẩn. Sinh viên chỉ nhập query vì cấu trúc bảng và dữ liệu đã có sẵn. Thay DENSE_RANK bằng ROW_NUMBER hoặc RANK sẽ làm sai ít nhất một dataset. Bảng đầu ra trong Preview phải có đủ cả hai nhân viên đồng hạng; dataset 2 không xuất hiện khi đã bật Hidden dataset. Việc so sánh kết quả hiện chưa kiểm tra thứ tự dòng, nên khi thử riêng ORDER BY cần quan sát thứ tự trong bảng kết quả.

---

## Bài 6 - Quản lý bán hàng từ PDF (44 query)

**Số gợi ý:** 252 cho query 6.1, tiếp tục 253-295 cho query 6.2-6.44 nếu tạo mỗi query thành một problem riêng. Đổi số nếu đã dùng.

**Nguồn:** `G:\My Drive\University\HK5\IS207_Web\BaiTap_THCSDL_v2025 (1).pdf`, Bài tập 1, trang 1-5. Chỉ chuyển bộ Quản lý bán hàng; query 6.x tương ứng câu x của phần III. Không gộp Bài tập 2 - Quản lý giáo vụ.

**Chọn trong Assignment/Contest:** gợi ý chỉ SQL. Cả 44 query dùng chung cấu trúc và dataset dưới đây; nếu thử DDL/DML thì bật các phần tương ứng khi gán bài.

**Cách đưa vào app**

1. Vào Database library, dùng Import SQL file với [import.sql](sql/bai-6-ban-hang/import.sql) để nạp cấu trúc và dữ liệu dùng chung. Hoặc sao chép riêng [create.sql](sql/bai-6-ban-hang/create.sql) và [insert.sql](sql/bai-6-ban-hang/insert.sql).
2. Với mỗi query 6.x, tạo một New problem, dùng nguyên yêu cầu của query đó làm Statement, import bộ database trên và chọn [queries/6.x.sql](sql/bai-6-ban-hang/queries) làm SQL Solution. Mỗi SQL Solution chỉ chạy một query; không dán cả 44 query vào cùng một ô.
3. Run để tự tạo Kết quả đầu ra mong đợi rồi nhấn Preview. Dataset này là dữ liệu gốc công khai, để hiện cho sinh viên; không tự tạo dataset ẩn hoặc thay đổi dữ liệu nguồn.

**Quy ước chuyển đổi**

- Giữ tên bảng/cột và chuỗi dữ liệu không dấu đúng PDF. Cột điện thoại NHANVIEN dùng `SODT` theo bảng thuộc tính trang 3; nhãn `DTHOAI` ở bảng dữ liệu trang 1 được ánh xạ sang cột này.
- Ngày `dd/mm/yyyy` trong PDF được ghi thành literal `YYYYMMDD` để không phụ thuộc DATEFORMAT. Điện thoại là chuỗi để giữ số 0 đầu; MAKH của hóa đơn khách vãng lai là NULL thật.
- CREATE có PK/FK và các CHECK đơn giản cho DVT, GIA, SL, NGDK. Không trộn các bài ALTER/UPDATE ở phần I-II vào dữ liệu nền, không thêm trigger tự sửa trị giá/doanh số.
- Hóa đơn 1003 được giữ nguyên `TRIGIA = 100000` như PDF, mặc dù dòng chi tiết BB03 có SL = 10 và giá 100000, thành tiền 1000000. Các query doanh thu cộng `HOADON.TRIGIA`, không tự tính lại từ CTHD.
- 6.26 lấy đúng ba khách hàng; 6.30 dùng DENSE_RANK để lấy ba hạng doanh số, giữ đồng hạng. 6.27-6.29 lấy ba mức giá phân biệt.
- 6.36 liệt kê các tháng có hóa đơn. 6.38 hiểu là đúng ba sản phẩm Việt Nam khác nhau; 6.41 tìm lượng bán thấp nhất trong các sản phẩm đã bán năm 2006. 6.44 lấy đúng 10 khách theo doanh số, dùng MAKH để ổn định thứ tự khi bằng doanh số, rồi giữ mọi khách đồng hạng về số lần mua.
- ORDER BY được thêm để kết quả dễ đối chiếu. Bộ chấm hiện tại chưa kiểm tra thứ tự dòng; với 6.7 cần quan sát thêm thứ tự thực tế khi Run.

**Database structure - `create.sql`**

```sql
CREATE TABLE KHACHHANG (
    MAKH CHAR(4) NOT NULL PRIMARY KEY,
    HOTEN VARCHAR(40) NOT NULL,
    DCHI VARCHAR(50) NULL,
    SODT VARCHAR(20) NULL,
    NGSINH SMALLDATETIME NULL,
    DOANHSO MONEY NOT NULL,
    NGDK SMALLDATETIME NOT NULL,
    CHECK (NGDK > NGSINH)
);

CREATE TABLE NHANVIEN (
    MANV CHAR(4) NOT NULL PRIMARY KEY,
    HOTEN VARCHAR(40) NOT NULL,
    NGVL SMALLDATETIME NOT NULL,
    SODT VARCHAR(20) NULL
);

CREATE TABLE SANPHAM (
    MASP CHAR(4) NOT NULL PRIMARY KEY,
    TENSP VARCHAR(40) NOT NULL,
    DVT VARCHAR(20) NOT NULL,
    NUOCSX VARCHAR(40) NOT NULL,
    GIA MONEY NOT NULL,
    CHECK (DVT IN ('cay', 'hop', 'cai', 'quyen', 'chuc')),
    CHECK (GIA >= 500)
);

CREATE TABLE HOADON (
    SOHD INT NOT NULL PRIMARY KEY,
    NGHD SMALLDATETIME NOT NULL,
    MAKH CHAR(4) NULL,
    MANV CHAR(4) NOT NULL,
    TRIGIA MONEY NOT NULL,
    FOREIGN KEY (MAKH) REFERENCES KHACHHANG(MAKH),
    FOREIGN KEY (MANV) REFERENCES NHANVIEN(MANV)
);

CREATE TABLE CTHD (
    SOHD INT NOT NULL,
    MASP CHAR(4) NOT NULL,
    SL INT NOT NULL,
    PRIMARY KEY (SOHD, MASP),
    FOREIGN KEY (SOHD) REFERENCES HOADON(SOHD),
    FOREIGN KEY (MASP) REFERENCES SANPHAM(MASP),
    CHECK (SL >= 1)
);
```

**Test dataset 1 - `insert.sql`** (giữ nguyên dữ liệu PDF)

| Bảng | Số dòng |
| --- | --- |
| KHACHHANG | 10 |
| NHANVIEN | 5 |
| SANPHAM | 24 |
| HOADON | 23 |
| CTHD | 48 |

```sql
INSERT INTO KHACHHANG (MAKH, HOTEN, DCHI, SODT, NGSINH, DOANHSO, NGDK)
VALUES
    ('KH01', 'Nguyen Van A', '731 Tran Hung Dao, Q5, TpHCM', '08823451', '19601022', 13060000, '20060722'),
    ('KH02', 'Tran Ngoc Han', '23/5 Nguyen Trai, Q5, TpHCM', '0908256478', '19740403', 280000, '20060730'),
    ('KH03', 'Tran Ngoc Linh', '45 Nguyen Canh Chan, Q1, TpHCM', '0938776266', '19800612', 3860000, '20060805'),
    ('KH04', 'Tran Minh Long', '50/34 Le Dai Hanh, Q10, TpHCM', '0917325476', '19650309', 250000, '20061002'),
    ('KH05', 'Le Nhat Minh', '34 Truong Dinh, Q3, TpHCM', '08246108', '19500310', 21000, '20061028'),
    ('KH06', 'Le Hoai Thuong', '227 Nguyen Van Cu, Q5, TpHCM', '08631738', '19811231', 915000, '20061124'),
    ('KH07', 'Nguyen Van Tam', '32/3 Tran Binh Trong, Q5, TpHCM', '0916783565', '19710406', 12500, '20061201'),
    ('KH08', 'Phan Thi Thanh', '45/2 An Duong Vuong, Q5, TpHCM', '0938435756', '19710110', 365000, '20061213'),
    ('KH09', 'Le Ha Vinh', '873 Le Hong Phong, Q5, TpHCM', '08654763', '19790903', 70000, '20070114'),
    ('KH10', 'Ha Duy Lap', '34/34B Nguyen Trai, Q1, TpHCM', '08768904', '19830502', 67500, '20070116');

INSERT INTO NHANVIEN (MANV, HOTEN, SODT, NGVL)
VALUES
    ('NV01', 'Nguyen Nhu Nhut', '0927345678', '20060413'),
    ('NV02', 'Le Thi Phi Yen', '0987567390', '20060421'),
    ('NV03', 'Nguyen Van B', '0997047382', '20060427'),
    ('NV04', 'Ngo Thanh Tuan', '0913758498', '20060624'),
    ('NV05', 'Nguyen Thi Truc Thanh', '0918590387', '20060720');

INSERT INTO SANPHAM (MASP, TENSP, DVT, NUOCSX, GIA)
VALUES
    ('BC01', 'But chi', 'cay', 'Singapore', 3000),
    ('BC02', 'But chi', 'cay', 'Singapore', 5000),
    ('BC03', 'But chi', 'cay', 'Viet Nam', 3500),
    ('BC04', 'But chi', 'hop', 'Viet Nam', 30000),
    ('BB01', 'But bi', 'cay', 'Viet Nam', 5000),
    ('BB02', 'But bi', 'cay', 'Trung Quoc', 7000),
    ('BB03', 'But bi', 'hop', 'Thai Lan', 100000),
    ('TV01', 'Tap 100 giay mong', 'quyen', 'Trung Quoc', 2500),
    ('TV02', 'Tap 200 giay mong', 'quyen', 'Trung Quoc', 4500),
    ('TV03', 'Tap 100 giay tot', 'quyen', 'Viet Nam', 3000),
    ('TV04', 'Tap 200 giay tot', 'quyen', 'Viet Nam', 5500),
    ('TV05', 'Tap 100 trang', 'chuc', 'Viet Nam', 23000),
    ('TV06', 'Tap 200 trang', 'chuc', 'Viet Nam', 53000),
    ('TV07', 'Tap 100 trang', 'chuc', 'Trung Quoc', 34000),
    ('ST01', 'So tay 500 trang', 'quyen', 'Trung Quoc', 40000),
    ('ST02', 'So tay loai 1', 'quyen', 'Viet Nam', 55000),
    ('ST03', 'So tay loai 2', 'quyen', 'Viet Nam', 51000),
    ('ST04', 'So tay', 'quyen', 'Thai Lan', 55000),
    ('ST05', 'So tay mong', 'quyen', 'Thai Lan', 20000),
    ('ST06', 'Phan viet bang', 'hop', 'Viet Nam', 5000),
    ('ST07', 'Phan khong bui', 'hop', 'Viet Nam', 7000),
    ('ST08', 'Bong bang', 'cai', 'Viet Nam', 1000),
    ('ST09', 'But long', 'cay', 'Viet Nam', 5000),
    ('ST10', 'But long', 'cay', 'Trung Quoc', 7000);

INSERT INTO HOADON (SOHD, NGHD, MAKH, MANV, TRIGIA)
VALUES
    (1001, '20060723', 'KH01', 'NV01', 320000),
    (1002, '20060812', 'KH01', 'NV02', 840000),
    (1003, '20060823', 'KH02', 'NV01', 100000),
    (1004, '20060901', 'KH02', 'NV01', 180000),
    (1005, '20061020', 'KH01', 'NV02', 3800000),
    (1006, '20061016', 'KH01', 'NV03', 2430000),
    (1007, '20061028', 'KH03', 'NV03', 510000),
    (1008, '20061028', 'KH01', 'NV03', 440000),
    (1009, '20061028', 'KH03', 'NV04', 200000),
    (1010, '20061101', 'KH01', 'NV01', 5200000),
    (1011, '20061104', 'KH04', 'NV03', 250000),
    (1012, '20061130', 'KH05', 'NV03', 21000),
    (1013, '20061212', 'KH06', 'NV01', 5000),
    (1014, '20061231', 'KH03', 'NV02', 3150000),
    (1015, '20070101', 'KH06', 'NV01', 910000),
    (1016, '20070101', 'KH07', 'NV02', 12500),
    (1017, '20070102', 'KH08', 'NV03', 35000),
    (1018, '20070113', 'KH08', 'NV03', 330000),
    (1019, '20070113', 'KH01', 'NV03', 30000),
    (1020, '20070114', 'KH09', 'NV04', 70000),
    (1021, '20070116', 'KH10', 'NV03', 67500),
    (1022, '20070116', NULL, 'NV03', 7000),
    (1023, '20070117', NULL, 'NV01', 330000);

INSERT INTO CTHD (SOHD, MASP, SL)
VALUES
    (1001, 'TV02', 10),
    (1001, 'ST01', 5),
    (1001, 'BC01', 5),
    (1001, 'BC02', 10),
    (1001, 'ST08', 10),
    (1002, 'BC04', 20),
    (1002, 'BB01', 20),
    (1002, 'BB02', 20),
    (1003, 'BB03', 10),
    (1004, 'TV01', 20),
    (1004, 'TV02', 10),
    (1004, 'TV03', 10),
    (1004, 'TV04', 10),
    (1005, 'TV05', 50),
    (1005, 'TV06', 50),
    (1006, 'TV07', 20),
    (1006, 'ST01', 30),
    (1006, 'ST02', 10),
    (1007, 'ST03', 10),
    (1008, 'ST04', 8),
    (1009, 'ST05', 10),
    (1010, 'TV07', 50),
    (1010, 'ST07', 50),
    (1010, 'ST08', 100),
    (1010, 'ST04', 50),
    (1010, 'TV03', 100),
    (1011, 'ST06', 50),
    (1012, 'ST07', 3),
    (1013, 'ST08', 5),
    (1014, 'BC02', 80),
    (1014, 'BB02', 100),
    (1014, 'BC04', 60),
    (1014, 'BB01', 50),
    (1015, 'BB02', 30),
    (1015, 'BB03', 7),
    (1016, 'TV01', 5),
    (1017, 'TV02', 1),
    (1017, 'TV03', 1),
    (1017, 'TV04', 5),
    (1018, 'ST04', 6),
    (1019, 'ST05', 1),
    (1019, 'ST06', 2),
    (1020, 'ST07', 10),
    (1021, 'ST08', 5),
    (1021, 'TV01', 7),
    (1021, 'TV02', 10),
    (1022, 'ST07', 1),
    (1023, 'ST04', 6);
```

### Các SQL Solution 6.1-6.44

#### Query 6.1

In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quoc” sản xuất.

[Tệp 6.1.sql](sql/bai-6-ban-hang/queries/6.1.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc'
ORDER BY MASP;
```

#### Query 6.2

In ra danh sách các sản phẩm (MASP, TENSP) có đơn vị tính là “cay”, ”quyen”.

[Tệp 6.2.sql](sql/bai-6-ban-hang/queries/6.2.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE DVT IN ('cay', 'quyen')
ORDER BY MASP;
```

#### Query 6.3

In ra danh sách các sản phẩm (MASP,TENSP) có mã sản phẩm bắt đầu là “B” và kết thúc là “01”.

[Tệp 6.3.sql](sql/bai-6-ban-hang/queries/6.3.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE MASP LIKE 'B%01'
ORDER BY MASP;
```

#### Query 6.4

In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quốc” sản xuất có giá từ 30.000 đến 40.000.

[Tệp 6.4.sql](sql/bai-6-ban-hang/queries/6.4.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc' AND GIA BETWEEN 30000 AND 40000
ORDER BY MASP;
```

#### Query 6.5

In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quoc” hoặc “Thai Lan” sản xuất có giá từ 30.000 đến 40.000.

[Tệp 6.5.sql](sql/bai-6-ban-hang/queries/6.5.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX IN ('Trung Quoc', 'Thai Lan') AND GIA BETWEEN 30000 AND 40000
ORDER BY MASP;
```

#### Query 6.6

In ra các số hóa đơn, trị giá hóa đơn bán ra trong ngày 1/1/2007 và ngày 2/1/2007.

[Tệp 6.6.sql](sql/bai-6-ban-hang/queries/6.6.sql)

```sql
SELECT SOHD, TRIGIA
FROM HOADON
WHERE NGHD >= '20070101' AND NGHD < '20070103'
ORDER BY SOHD;
```

#### Query 6.7

In ra các số hóa đơn, trị giá hóa đơn trong tháng 1/2007, sắp xếp theo ngày (tăng dần) và trị giá của hóa đơn (giảm dần).

[Tệp 6.7.sql](sql/bai-6-ban-hang/queries/6.7.sql)

```sql
SELECT SOHD, TRIGIA
FROM HOADON
WHERE NGHD >= '20070101' AND NGHD < '20070201'
ORDER BY NGHD ASC, TRIGIA DESC, SOHD ASC;
```

#### Query 6.8

In ra danh sách các khách hàng (MAKH, HOTEN) đã mua hàng trong ngày 1/1/2007.

[Tệp 6.8.sql](sql/bai-6-ban-hang/queries/6.8.sql)

```sql
SELECT kh.MAKH, kh.HOTEN
FROM KHACHHANG AS kh
WHERE EXISTS (
    SELECT 1 FROM HOADON AS hd
    WHERE hd.MAKH = kh.MAKH AND hd.NGHD >= '20070101' AND hd.NGHD < '20070102'
)
ORDER BY kh.MAKH;
```

#### Query 6.9

In ra số hóa đơn, trị giá các hóa đơn do nhân viên có tên “Nguyen Van B” lập trong ngày 28/10/2006.

[Tệp 6.9.sql](sql/bai-6-ban-hang/queries/6.9.sql)

```sql
SELECT hd.SOHD, hd.TRIGIA
FROM HOADON AS hd
INNER JOIN NHANVIEN AS nv ON nv.MANV = hd.MANV
WHERE nv.HOTEN = 'Nguyen Van B' AND hd.NGHD >= '20061028' AND hd.NGHD < '20061029'
ORDER BY hd.SOHD;
```

#### Query 6.10

In ra danh sách các sản phẩm (MASP,TENSP) được khách hàng có tên “Nguyen Van A” mua trong tháng 10/2006.

[Tệp 6.10.sql](sql/bai-6-ban-hang/queries/6.10.sql)

```sql
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    INNER JOIN KHACHHANG AS kh ON kh.MAKH = hd.MAKH
    WHERE ct.MASP = sp.MASP AND kh.HOTEN = 'Nguyen Van A'
      AND hd.NGHD >= '20061001' AND hd.NGHD < '20061101'
)
ORDER BY sp.MASP;
```

#### Query 6.11

Tìm các số hóa đơn đã mua sản phẩm có mã số “BB01” hoặc “BB02”.

[Tệp 6.11.sql](sql/bai-6-ban-hang/queries/6.11.sql)

```sql
SELECT DISTINCT SOHD
FROM CTHD
WHERE MASP IN ('BB01', 'BB02')
ORDER BY SOHD;
```

#### Query 6.12

Tìm các số hóa đơn đã mua sản phẩm có mã số “BB01” hoặc “BB02”, mỗi sản phẩm mua với số lượng từ 10 đến 20.

[Tệp 6.12.sql](sql/bai-6-ban-hang/queries/6.12.sql)

```sql
SELECT DISTINCT SOHD
FROM CTHD
WHERE MASP IN ('BB01', 'BB02') AND SL BETWEEN 10 AND 20
ORDER BY SOHD;
```

#### Query 6.13

Tìm các số hóa đơn mua cùng lúc 2 sản phẩm có mã số “BB01” và “BB02”, mỗi sản phẩm mua với số lượng từ 10 đến 20.

[Tệp 6.13.sql](sql/bai-6-ban-hang/queries/6.13.sql)

```sql
SELECT SOHD
FROM CTHD
WHERE MASP IN ('BB01', 'BB02') AND SL BETWEEN 10 AND 20
GROUP BY SOHD
HAVING COUNT(DISTINCT MASP) = 2
ORDER BY SOHD;
```

#### Query 6.14

In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quoc” sản xuất hoặc các sản phẩm được bán ra trong ngày 1/1/2007.

[Tệp 6.14.sql](sql/bai-6-ban-hang/queries/6.14.sql)

```sql
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE sp.NUOCSX = 'Trung Quoc' OR EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE ct.MASP = sp.MASP AND hd.NGHD >= '20070101' AND hd.NGHD < '20070102'
)
ORDER BY sp.MASP;
```

#### Query 6.15

In ra danh sách các sản phẩm (MASP,TENSP) không bán được.

[Tệp 6.15.sql](sql/bai-6-ban-hang/queries/6.15.sql)

```sql
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE NOT EXISTS (SELECT 1 FROM CTHD AS ct WHERE ct.MASP = sp.MASP)
ORDER BY sp.MASP;
```

#### Query 6.16

In ra danh sách các sản phẩm (MASP,TENSP) không bán được trong năm 2006.

[Tệp 6.16.sql](sql/bai-6-ban-hang/queries/6.16.sql)

```sql
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE NOT EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE ct.MASP = sp.MASP AND hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
)
ORDER BY sp.MASP;
```

#### Query 6.17

In ra danh sách các sản phẩm (MASP,TE NSP) do “Trung Quoc” sản xuất không bán được trong năm 2006.

[Tệp 6.17.sql](sql/bai-6-ban-hang/queries/6.17.sql)

```sql
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE sp.NUOCSX = 'Trung Quoc' AND NOT EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE ct.MASP = sp.MASP AND hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
)
ORDER BY sp.MASP;
```

#### Query 6.18

Tìm số hóa đơn trong năm 2006 đã mua ít nhất tất cả các sản phẩm do Singapore sản xuất.

[Tệp 6.18.sql](sql/bai-6-ban-hang/queries/6.18.sql)

```sql
SELECT hd.SOHD
FROM HOADON AS hd
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
  AND NOT EXISTS (
      SELECT 1 FROM SANPHAM AS sp
      WHERE sp.NUOCSX = 'Singapore' AND NOT EXISTS (
          SELECT 1 FROM CTHD AS ct WHERE ct.SOHD = hd.SOHD AND ct.MASP = sp.MASP
      )
  )
ORDER BY hd.SOHD;
```

#### Query 6.19

Có bao nhiêu hóa đơn không phải của khách hàng đăng ký thành viên mua?

[Tệp 6.19.sql](sql/bai-6-ban-hang/queries/6.19.sql)

```sql
SELECT COUNT(*) AS SO_HOA_DON_KHACH_VANG_LAI
FROM HOADON
WHERE MAKH IS NULL;
```

#### Query 6.20

Có bao nhiêu sản phẩm khác nhau được bán ra trong năm 2006.

[Tệp 6.20.sql](sql/bai-6-ban-hang/queries/6.20.sql)

```sql
SELECT COUNT(DISTINCT ct.MASP) AS SO_SAN_PHAM_DA_BAN
FROM CTHD AS ct
INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101';
```

#### Query 6.21

Cho biết trị giá hóa đơn cao nhất, thấp nhất là bao nhiêu?

[Tệp 6.21.sql](sql/bai-6-ban-hang/queries/6.21.sql)

```sql
SELECT MAX(TRIGIA) AS TRI_GIA_CAO_NHAT, MIN(TRIGIA) AS TRI_GIA_THAP_NHAT
FROM HOADON;
```

#### Query 6.22

Trị giá trung bình của tất cả các hóa đơn được bán ra trong năm 2006 là bao nhiêu?

[Tệp 6.22.sql](sql/bai-6-ban-hang/queries/6.22.sql)

```sql
SELECT AVG(TRIGIA) AS TRI_GIA_TRUNG_BINH
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101';
```

#### Query 6.23

Tính doanh thu bán hàng trong năm 2006.

[Tệp 6.23.sql](sql/bai-6-ban-hang/queries/6.23.sql)

```sql
SELECT SUM(TRIGIA) AS DOANH_THU_2006
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101';
```

#### Query 6.24

Tìm số hóa đơn có trị giá cao nhất trong năm 2006.

[Tệp 6.24.sql](sql/bai-6-ban-hang/queries/6.24.sql)

```sql
SELECT SOHD
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101'
  AND TRIGIA = (
      SELECT MAX(TRIGIA) FROM HOADON
      WHERE NGHD >= '20060101' AND NGHD < '20070101'
  )
ORDER BY SOHD;
```

#### Query 6.25

Tìm họ tên khách hàng đã mua hóa đơn có trị giá cao nhất trong năm 2006.

[Tệp 6.25.sql](sql/bai-6-ban-hang/queries/6.25.sql)

```sql
SELECT DISTINCT kh.HOTEN
FROM KHACHHANG AS kh
INNER JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
  AND hd.TRIGIA = (
      SELECT MAX(TRIGIA) FROM HOADON
      WHERE NGHD >= '20060101' AND NGHD < '20070101'
  )
ORDER BY kh.HOTEN;
```

#### Query 6.26

In ra danh sách 3 khách hàng (MAKH, HOTEN) có doanh số cao nhất.

[Tệp 6.26.sql](sql/bai-6-ban-hang/queries/6.26.sql)

```sql
SELECT TOP (3) MAKH, HOTEN
FROM KHACHHANG
ORDER BY DOANHSO DESC, MAKH ASC;
```

#### Query 6.27

In ra danh sách các sản phẩm (MASP, TENSP) có giá bán bằng 1 trong 3 mức giá cao nhất.

[Tệp 6.27.sql](sql/bai-6-ban-hang/queries/6.27.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE GIA IN (SELECT DISTINCT TOP (3) GIA FROM SANPHAM ORDER BY GIA DESC)
ORDER BY GIA DESC, MASP;
```

#### Query 6.28

In ra danh sách các sản phẩm (MASP, TENSP) do “Thai Lan” sản xuất có giá bằng 1 trong 3 mức giá cao nhất (của tất cả các sản phẩm).

[Tệp 6.28.sql](sql/bai-6-ban-hang/queries/6.28.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Thai Lan'
  AND GIA IN (SELECT DISTINCT TOP (3) GIA FROM SANPHAM ORDER BY GIA DESC)
ORDER BY GIA DESC, MASP;
```

#### Query 6.29

In ra danh sách các sản phẩm (MASP, TENSP) do “Trung Quoc” sản xuất có giá bằng 1 trong 3 mức giá cao nhất (của sản phẩm do “Trung Quoc” sản xuất).

[Tệp 6.29.sql](sql/bai-6-ban-hang/queries/6.29.sql)

```sql
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc'
  AND GIA IN (
      SELECT DISTINCT TOP (3) GIA FROM SANPHAM
      WHERE NUOCSX = 'Trung Quoc' ORDER BY GIA DESC
  )
ORDER BY GIA DESC, MASP;
```

#### Query 6.30

In ra danh sách 3 khách hàng có doanh số cao nhất (sắp xếp theo kiểu xếp hạng).

[Tệp 6.30.sql](sql/bai-6-ban-hang/queries/6.30.sql)

```sql
WITH XepHang AS (
    SELECT MAKH, HOTEN, DOANHSO,
           DENSE_RANK() OVER (ORDER BY DOANHSO DESC) AS HANG
    FROM KHACHHANG
)
SELECT MAKH, HOTEN, DOANHSO, HANG
FROM XepHang
WHERE HANG <= 3
ORDER BY HANG, MAKH;
```

#### Query 6.31

Tính tổng số sản phẩm do “Trung Quoc” sản xuất.

[Tệp 6.31.sql](sql/bai-6-ban-hang/queries/6.31.sql)

```sql
SELECT COUNT(*) AS SO_SAN_PHAM_TRUNG_QUOC
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc';
```

#### Query 6.32

Tính tổng số sản phẩm của từng nước sản xuất.

[Tệp 6.32.sql](sql/bai-6-ban-hang/queries/6.32.sql)

```sql
SELECT NUOCSX, COUNT(*) AS SO_SAN_PHAM
FROM SANPHAM
GROUP BY NUOCSX
ORDER BY NUOCSX;
```

#### Query 6.33

Với từng nước sản xuất, tìm giá bán cao nhất, thấp nhất, trung bình của các sản phẩm.

[Tệp 6.33.sql](sql/bai-6-ban-hang/queries/6.33.sql)

```sql
SELECT NUOCSX, MAX(GIA) AS GIA_CAO_NHAT, MIN(GIA) AS GIA_THAP_NHAT, AVG(GIA) AS GIA_TRUNG_BINH
FROM SANPHAM
GROUP BY NUOCSX
ORDER BY NUOCSX;
```

#### Query 6.34

Tính doanh thu bán hàng mỗi ngày.

[Tệp 6.34.sql](sql/bai-6-ban-hang/queries/6.34.sql)

```sql
SELECT CAST(NGHD AS DATE) AS NGAY, SUM(TRIGIA) AS DOANH_THU
FROM HOADON
GROUP BY CAST(NGHD AS DATE)
ORDER BY NGAY;
```

#### Query 6.35

Tính tổng số lượng của từng sản phẩm bán ra trong tháng 10/2006.

[Tệp 6.35.sql](sql/bai-6-ban-hang/queries/6.35.sql)

```sql
SELECT sp.MASP, sp.TENSP, SUM(ct.SL) AS TONG_SO_LUONG
FROM SANPHAM AS sp
INNER JOIN CTHD AS ct ON ct.MASP = sp.MASP
INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
WHERE hd.NGHD >= '20061001' AND hd.NGHD < '20061101'
GROUP BY sp.MASP, sp.TENSP
ORDER BY sp.MASP;
```

#### Query 6.36

Tính doanh thu bán hàng của từng tháng trong năm 2006.

[Tệp 6.36.sql](sql/bai-6-ban-hang/queries/6.36.sql)

```sql
SELECT MONTH(NGHD) AS THANG, SUM(TRIGIA) AS DOANH_THU
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101'
GROUP BY MONTH(NGHD)
ORDER BY THANG;
```

#### Query 6.37

Tìm hóa đơn có mua ít nhất 4 sản phẩm khác nhau.

[Tệp 6.37.sql](sql/bai-6-ban-hang/queries/6.37.sql)

```sql
SELECT SOHD
FROM CTHD
GROUP BY SOHD
HAVING COUNT(DISTINCT MASP) >= 4
ORDER BY SOHD;
```

#### Query 6.38

Tìm hóa đơn có mua 3 sản phẩm do “Viet Nam” sản xuất (3 sản phẩm khác nhau).

[Tệp 6.38.sql](sql/bai-6-ban-hang/queries/6.38.sql)

```sql
SELECT ct.SOHD
FROM CTHD AS ct
INNER JOIN SANPHAM AS sp ON sp.MASP = ct.MASP
WHERE sp.NUOCSX = 'Viet Nam'
GROUP BY ct.SOHD
HAVING COUNT(DISTINCT ct.MASP) = 3
ORDER BY ct.SOHD;
```

#### Query 6.39

Tìm khách hàng (MAKH, HOTEN) có số lần mua hàng nhiều nhất.

[Tệp 6.39.sql](sql/bai-6-ban-hang/queries/6.39.sql)

```sql
WITH SoLanMua AS (
    SELECT kh.MAKH, kh.HOTEN, COUNT(hd.SOHD) AS SO_LAN_MUA
    FROM KHACHHANG AS kh
    LEFT JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
    GROUP BY kh.MAKH, kh.HOTEN
)
SELECT MAKH, HOTEN
FROM SoLanMua
WHERE SO_LAN_MUA = (SELECT MAX(SO_LAN_MUA) FROM SoLanMua)
ORDER BY MAKH;
```

#### Query 6.40

Tháng mấy trong năm 2006, doanh số bán hàng cao nhất ?

[Tệp 6.40.sql](sql/bai-6-ban-hang/queries/6.40.sql)

```sql
WITH DoanhThuThang AS (
    SELECT MONTH(NGHD) AS THANG, SUM(TRIGIA) AS DOANH_THU
    FROM HOADON
    WHERE NGHD >= '20060101' AND NGHD < '20070101'
    GROUP BY MONTH(NGHD)
)
SELECT THANG
FROM DoanhThuThang
WHERE DOANH_THU = (SELECT MAX(DOANH_THU) FROM DoanhThuThang)
ORDER BY THANG;
```

#### Query 6.41

Tìm sản phẩm (MASP, TENSP) có tổng số lượng bán ra thấp nhất trong năm 2006.

[Tệp 6.41.sql](sql/bai-6-ban-hang/queries/6.41.sql)

```sql
WITH LuongBan AS (
    SELECT sp.MASP, sp.TENSP, SUM(ct.SL) AS TONG_SO_LUONG
    FROM SANPHAM AS sp
    INNER JOIN CTHD AS ct ON ct.MASP = sp.MASP
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
    GROUP BY sp.MASP, sp.TENSP
)
SELECT MASP, TENSP
FROM LuongBan
WHERE TONG_SO_LUONG = (SELECT MIN(TONG_SO_LUONG) FROM LuongBan)
ORDER BY MASP;
```

#### Query 6.42

Mỗi nước sản xuất, tìm sản phẩm (MASP,TENSP) có giá bán cao nhất.

[Tệp 6.42.sql](sql/bai-6-ban-hang/queries/6.42.sql)

```sql
SELECT sp.NUOCSX, sp.MASP, sp.TENSP, sp.GIA
FROM SANPHAM AS sp
WHERE sp.GIA = (SELECT MAX(sp2.GIA) FROM SANPHAM AS sp2 WHERE sp2.NUOCSX = sp.NUOCSX)
ORDER BY sp.NUOCSX, sp.MASP;
```

#### Query 6.43

Tìm nước sản xuất sản xuất ít nhất 3 sản phẩm có giá bán khác nhau.

[Tệp 6.43.sql](sql/bai-6-ban-hang/queries/6.43.sql)

```sql
SELECT NUOCSX
FROM SANPHAM
GROUP BY NUOCSX
HAVING COUNT(DISTINCT GIA) >= 3
ORDER BY NUOCSX;
```

#### Query 6.44

Trong 10 khách hàng có doanh số cao nhất, tìm khách hàng có số lần mua hàng nhiều nhất.

[Tệp 6.44.sql](sql/bai-6-ban-hang/queries/6.44.sql)

```sql
WITH TopKhachHang AS (
    SELECT TOP (10) MAKH, HOTEN
    FROM KHACHHANG
    ORDER BY DOANHSO DESC, MAKH ASC
), SoLanMua AS (
    SELECT kh.MAKH, kh.HOTEN, COUNT(hd.SOHD) AS SO_LAN_MUA
    FROM TopKhachHang AS kh
    LEFT JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
    GROUP BY kh.MAKH, kh.HOTEN
)
SELECT MAKH, HOTEN
FROM SoLanMua
WHERE SO_LAN_MUA = (SELECT MAX(SO_LAN_MUA) FROM SoLanMua)
ORDER BY MAKH;
```

---

## Checklist Submit/Exit

1. Mở bài ở vai trò sinh viên và xác nhận tab **Submission** luôn xuất hiện.
2. Sửa code rồi nhấn **Exit** trước khi nộp; xác nhận hộp thoại cảnh báo và chọn ở lại.
3. Nhấn **Submit**; xác nhận vẫn ở workspace, code chuyển thành chỉ xem và Submission hiện bài vừa nộp.
4. Nhấn **Edit again**, sửa code, rồi nhấn **Exit** để kiểm tra cảnh báo thay đổi chưa nộp.
5. Lặp lại với DDL/DML ở bài 3 và DML-only ở bài 4. Thử DDL sai cú pháp và lặp cùng một khóa chính hai lần trong một script INSERT để kiểm tra thông báo lỗi.
6. Ở bài 2, chỉ nhập DDL rồi Submit để kiểm tra việc hệ thống tự nạp dataset và chạy query giảng viên. Ở bài 5, thử query đúng và query dùng ROW_NUMBER để đối chiếu kết quả chấm.
