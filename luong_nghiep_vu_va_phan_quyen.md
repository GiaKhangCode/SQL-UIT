# TÀI LIỆU LUỒNG NGHIỆP VỤ VÀ PHÂN QUYỀN HỆ THỐNG SQL-UIT

Tài liệu này mô tả chi tiết các phân quyền (Roles) và các luồng nghiệp vụ (Business Flows) cốt lõi của hệ thống SQL-UIT dựa trên kiến trúc API backend.

---

## 1. PHÂN QUYỀN (ROLE-BASED ACCESS CONTROL)

Hệ thống SQL-UIT sử dụng cơ chế xác thực JWT (JSON Web Tokens) và phân quyền người dùng thành 3 vai trò (Roles) chính: **Admin**, **Instructor** (Giảng viên) và **Student** (Sinh viên).

### 1.1. Admin (Quản trị viên)
Là vai trò có quyền lực cao nhất trong hệ thống, bao gồm tất cả các quyền của Instructor cộng thêm các quyền quản lý ở cấp hệ thống:
- **Quản lý Users**: Xem danh sách toàn bộ người dùng, duyệt tài khoản giảng viên (từ `Pending` sang `Active`), thay đổi vai trò (Role) hoặc trạng thái (Status) của người dùng.
- **Quản lý Classes**: Có toàn quyền xem, thêm, sửa, xóa, và gán sinh viên vào tất cả các lớp học trên hệ thống.
- **Quản lý Problems & Assignments**: Có quyền truy cập, chỉnh sửa, và xóa bất kỳ bài tập (Problem) hay bài kiểm tra (Assignment) nào của bất kỳ giảng viên nào.
- **Thống kê (Dashboard)**: Xem các chỉ số tổng quan (Overview) về hoạt động của toàn bộ hệ thống.

### 1.2. Instructor (Giảng viên)
Vai trò này dành cho các giảng viên điều hành lớp học và tạo nội dung bài tập.
- **Quản lý Problems (Bài tập)**: Có quyền tạo mới bài tập, định nghĩa test cases (script tạo bảng, dữ liệu mẫu, câu lệnh truy vấn mong đợi). Chỉ có quyền chỉnh sửa/xóa các bài tập do chính mình tạo ra (`creator_id`).
- **Quản lý Classes (Lớp học)**: Được quyền tạo lớp học, quản lý thành viên (sinh viên) trong các lớp học do mình phụ trách.
- **Quản lý Assignments (Giao bài/Kỳ thi)**: Được quyền tạo các Assignments (bài tập về nhà) hoặc Contests (kỳ thi), gán các Problems vào Assignment, và thiết lập các tùy chọn như: thời gian mở/đóng, cho phép dùng AI, cho phép xem hint, hay có bảng xếp hạng (Leaderboard) hay không. Chỉ áp dụng cho các lớp mình phụ trách.
- **Chấm bài (Review Submissions)**: Được xem danh sách bài nộp của sinh viên trong Assignment do mình tạo, được ghi đè điểm số tự động (Evaluated Score) và để lại nhận xét (Feedback) cho sinh viên.

### 1.3. Student (Sinh viên)
Là đối tượng người dùng cuối, tương tác với hệ thống để học tập và rèn luyện SQL.
- **Tham gia lớp học**: Có thể xem danh sách các lớp học mình đã được ghi danh (Enroll).
- **Làm bài tập & Kỳ thi**: Có thể làm các bài tập tự do (Practice) hoặc các bài tập nằm trong Assignment/Contest (nếu đang trong khoảng thời gian cho phép). 
- **Submit Query**: Gửi câu lệnh SQL để hệ thống chấm điểm tự động. Hệ thống sẽ so sánh kết quả truy vấn của sinh viên với kết quả mong đợi (Expected Query).
- **Trợ giảng AI**: Sử dụng tính năng AI Chat để hỏi đáp về một bài tập cụ thể.
- **Không gian cá nhân**: Xem lịch sử nộp bài cá nhân, quản lý danh sách bài tập yêu thích (Favorites) và tạo các danh sách bài tập cá nhân (Problem Lists).

---

## 2. CÁC LUỒNG NGHIỆP VỤ CHÍNH (BUSINESS FLOWS)

Dưới đây là các luồng hoạt động chính phản ánh cách các Role tương tác với nhau.

### 2.1. Luồng Đăng ký và Xác thực (Authentication Flow)
- **Sinh viên đăng ký**: Sinh viên đăng ký qua API `/register`, hệ thống tự động gán vai trò `student` và trạng thái `Active`. Sinh viên có thể đăng nhập ngay.
- **Giảng viên đăng ký**: Đăng ký qua API `/register-lecturer`, hệ thống gán vai trò `instructor` nhưng trạng thái mặc định là `Pending`. Giảng viên chưa thể đăng nhập.
- **Phê duyệt**: Admin đăng nhập, vào trang Quản lý User, thay đổi trạng thái của tài khoản giảng viên từ `Pending` sang `Active`.
- **Đăng nhập**: Người dùng (bất kể vai trò) gọi API `/login` bằng Email/Password. Nếu trạng thái `Active` và thông tin chính xác, hệ thống trả về `access_token` (JWT).

### 2.2. Luồng Tạo bài tập và Sandbox Test Cases (Problem Creation Flow)
- Instructor vào tính năng tạo Problem, nhập mô tả, yêu cầu đề bài.
- Instructor định nghĩa **Test Cases**. Mỗi Test Case sẽ cần:
  - Script tạo bảng (CREATE TABLE).
  - Script chèn dữ liệu mẫu (INSERT).
  - Câu lệnh truy vấn chuẩn (Expected Query).
- Hệ thống hỗ trợ Sandbox (in-memory) để chạy thử các test cases này nhằm đảm bảo tính hợp lệ trước khi lưu.
- Instructor có thể đánh dấu bài tập này là bài luyện tập tự do (`practice_listed` = True/False) để sinh viên ngoài lớp cũng có thể thấy.

### 2.3. Luồng Giao Bài tập / Kỳ thi (Assignment & Contest Flow)
- Instructor tạo một Assignment, định nghĩa loại hình là "Assignment" (bài tập nhóm/cá nhân) hoặc "Contest" (kỳ thi).
- Thiết lập thời gian `opens` (bắt đầu) và `closes` (kết thúc).
- Cấu hình các flag: `hints_enabled` (cho phép gợi ý), `ai_allowed` (cho phép dùng AI), `leaderboard_enabled` (hiện bảng xếp hạng).
- Thêm các Problems đã tạo vào Assignment và ấn định trọng số điểm (`points`) cho mỗi Problem.
- Gắn Assignment vào các Lớp học (Classes) cụ thể (chỉ sinh viên lớp này mới được làm bài).
- Cuối cùng, giảng viên chuyển trạng thái `published = True` để sinh viên bắt đầu nhìn thấy.

### 2.4. Luồng Sinh viên Làm bài và Chấm điểm tự động (Submission & Evaluation Flow)
- Sinh viên truy cập vào Assignment, chọn Problem để giải quyết.
- **Chạy thử (Run)**: Sinh viên viết SQL và ấn "Run" (`/run`). Backend gửi câu lệnh vào Sandbox để thực thi (không tính là một lần Submit chính thức), trả về kết quả (dữ liệu trả về hoặc lỗi).
- **Nộp bài (Submit)**: Sinh viên ấn "Submit" (`/submit`). 
  - Backend kiểm tra tính hợp lệ khắt khe: Nếu là bài tập Private (nằm trong Assignment), hệ thống bắt buộc kiểm tra xem Assignment đã được công bố chưa, đã tới giờ chưa, có quá hạn (deadline) không và sinh viên có nằm trong danh sách lớp không (Ngăn chặn hoàn toàn việc bypass nộp tự do qua "Practice").
  - Nếu hợp lệ, đưa câu lệnh vào Sandbox chạy qua toàn bộ Test Cases. Dữ liệu bảng kết quả sẽ được Sandbox tự động sắp xếp lại (sort) trước khi so sánh để tránh báo lỗi "Wrong Answer" oan uổng khi thiếu mệnh đề ORDER BY.
  - **Chấm điểm thành phần (Partial Scoring)**: 
    - Nếu đúng 100% Test Cases $\Rightarrow$ `Accepted`, điểm tự động là tối đa.
    - Nếu đúng một phần Test Cases $\Rightarrow$ `Partial`, điểm tự động được tính theo tỷ lệ phần trăm (số test case đúng / tổng số test case).
    - Nếu sai toàn bộ $\Rightarrow$ `Wrong Answer` hoặc `Error`, điểm tự động là 0.
  - Lưu bản ghi vào bảng `Submissions` và cập nhật thanh tiến trình (In progress / Solved).

### 2.5. Luồng Chấm thi thủ công của Giảng viên (Manual Review Flow)
- Dù hệ thống chấm tự động, Instructor vẫn có thể truy cập danh sách các bài nộp (Submissions) mới nhất của từng sinh viên trong Assignment do chính mình tạo (đã được lọc trùng lặp).
- Instructor gọi API `/submissions/{id}` để xem lại chi tiết bài làm, số lần thử, điểm chấm tự động, và đáp án gốc. 
- Nếu thấy hệ thống chấm tự động chưa thỏa đáng, Instructor dùng tính năng Review (`PUT /submissions/{id}/review`).
- Instructor cung cấp Điểm số cuối cùng (`finalScore`) và Lời nhận xét (`feedback`). Điểm này sẽ ghi đè (`evaluated_score`) lên kết quả tự động.
- Trạng thái tiến trình của bài tập cũng sẽ tự động chuyển đổi tương ứng: `"Rejected"` (0 điểm), `"Partial"` (điểm vớt vát lẻ), hoặc `"Accepted"` (điểm tuyệt đối). Nhờ đó bảng theo dõi tiến độ (Dashboard) của sinh viên luôn phản ánh chính xác 100% hiệu suất học tập.

### 2.6. Luồng Trợ giảng AI (AI Assistant Flow)
- Nếu Assignment cho phép (`ai_allowed = True`), sinh viên có thể bật hộp thoại Chat AI.
- Hệ thống khởi tạo một phiên Chat (`AiChatSession`). 
- Khi sinh viên đặt câu hỏi, backend gộp Context (Thông tin bài tập, Schema, Lỗi hiện tại nếu có) gửi lên API LLM (Google Gemini / OpenAI).
- Kết quả phản hồi được lưu trữ trong `AiChatMessage` và hiển thị lại cho sinh viên, giúp sinh viên tự debug lỗi SQL mà không cung cấp lời giải trực tiếp.
