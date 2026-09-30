# Hướng Dẫn Deploy SQL-UIT Toàn Diện

Ứng dụng SQL-UIT của bạn gồm 3 thành phần chính, do đó việc deploy sẽ cần xử lý từng phần một:
1. **Frontend (React + Vite):** Nơi chứa giao diện người dùng (chỉ là các file tĩnh HTML/CSS/JS sau khi build).
2. **Backend (FastAPI - Python):** Nơi xử lý logic nghiệp vụ và chạy mã SQL.
3. **Cơ sở dữ liệu (SQL Server):** Nơi lưu trữ dữ liệu người dùng và các bài tập.

Dưới đây là 2 phương án deploy phổ biến và hiệu quả nhất cho ứng dụng này.

---

## 🚀 Phương án 1: Dùng các dịch vụ Cloud PaaS (Dễ nhất, Miễn phí/Giá rẻ)
Phương án này tách biệt 3 thành phần ra 3 dịch vụ đám mây chuyên biệt. Rất phù hợp cho sinh viên hoặc dự án mới bắt đầu.

### 1. Database: Azure SQL Database
Vì ứng dụng của bạn bắt buộc dùng **SQL Server** (thư viện `pyodbc`), Microsoft Azure là lựa chọn tốt nhất.
*   **Bước 1:** Tạo tài khoản [Microsoft Azure](https://azure.microsoft.com/) (thường được miễn phí gói Basic trong 12 tháng).
*   **Bước 2:** Tìm dịch vụ **Azure SQL Database** và tạo một database mới.
*   **Bước 3:** Cấu hình **Firewall** của Database để cho phép tất cả các IP truy cập (Allow all Azure services and external IPs) để Backend có thể gọi vào.
*   **Bước 4:** Lấy chuỗi kết nối (Connection String) dạng:
    `mssql+pyodbc://<username>:<password>@<server-name>.database.windows.net/<db-name>?driver=ODBC+Driver+17+for+SQL+Server`

### 2. Backend (FastAPI): Render hoặc Railway
[Render.com](https://render.com/) hoặc [Railway.app](https://railway.app/) cho phép deploy ứng dụng Python rất dễ qua GitHub. Ở đây dùng Render làm ví dụ:
*   **Bước 1:** Push toàn bộ code (thư mục `backend`) lên một kho lưu trữ (Repository) trên GitHub.
*   **Bước 2:** Tạo tài khoản Render, chọn **New Web Service**, và kết nối với kho GitHub của bạn.
*   **Bước 3:** Cấu hình Web Service:
    *   **Root Directory:** `backend`
    *   **Environment:** `Python 3`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
*   **Bước 4:** Thêm các biến môi trường (**Environment Variables**):
    *   `DATABASE_URL`: (Điền Connection String từ Azure SQL ở trên)
    *   `GEMINI_API_KEY`: (API Key của bạn)
*   **Bước 5:** Lưu lại và chờ Render build. Sau khi hoàn tất, bạn sẽ có một link API, ví dụ: `https://sql-uit-backend.onrender.com`.

### 3. Frontend (React/Vite): Vercel
[Vercel](https://vercel.com/) là dịch vụ số 1 hiện nay để deploy ứng dụng React frontend.
*   **Bước 1:** Trước khi đưa lên, bạn cần mở file `.env` ở thư mục `frontend` và cấu hình biến chỉ tới Backend thật (thay vì proxy localhost):
    `VITE_API_BASE_URL=https://sql-uit-backend.onrender.com/api`
    *(Lưu ý: Bạn cũng cần cấu hình Frontend code để đọc biến môi trường này).*
*   **Bước 2:** Đẩy (Push) thư mục `frontend` lên GitHub.
*   **Bước 3:** Đăng nhập Vercel, chọn **Add New Project**, liên kết với kho GitHub.
*   **Bước 4:** Vercel sẽ tự động nhận diện đây là dự án Vite. Bạn chỉ cần cấu hình:
    *   **Root Directory:** `frontend`
    *   **Build Command:** `npm run build`
*   **Bước 5:** Bấm **Deploy**. Sau khoảng 1 phút, bạn sẽ có ngay một đường link sống (Live URL) để sử dụng ứng dụng!

---

## 🛠️ Phương án 2: Tự Host trên một Máy Chủ Ảo (VPS + Docker)
Phương án này dành cho việc chạy production thực tế vì nó rẻ, ổn định và gom tất cả mọi thứ vào một server duy nhất.

### 1. Chuẩn bị VPS
Thuê một máy chủ ảo (VPS) chạy Linux (Ubuntu 22.04) từ các nhà cung cấp như **DigitalOcean, Linode, AWS EC2, hoặc Vultr**. Yêu cầu RAM tối thiểu 4GB vì SQL Server cho Linux khá nặng.

### 2. Cài đặt Docker & Docker Compose
Truy cập vào máy chủ qua SSH và cài đặt Docker để dễ dàng quản lý môi trường.

### 3. Viết file `docker-compose.yml`
Tạo một file `docker-compose.yml` tại thư mục gốc của dự án chứa cả frontend, backend và SQL Server.

```yaml
version: '3.8'

services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrong!Passw0rd"
    ports:
      - "1433:1433"
    volumes:
      - sqlvolume:/var/opt/mssql

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: "mssql+pyodbc://sa:YourStrong!Passw0rd@sqlserver/SQLUIT?driver=ODBC+Driver+17+for+SQL+Server"
      GEMINI_API_KEY: "your-api-key"
    depends_on:
      - sqlserver

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  sqlvolume:
```

### 4. Viết Dockerfile cho Backend và Frontend
*   **Backend (`backend/Dockerfile`):** Cài đặt Python 3, cài Microsoft ODBC Driver 17 cho Linux, cài `requirements.txt` và chạy lệnh `uvicorn`.
*   **Frontend (`frontend/Dockerfile`):** Build từ node image `npm run build`, sau đó dùng `nginx` image để serve thư mục `dist/` ra port 80. (Nhớ cấu hình proxy trong file `nginx.conf` để dẫn `/api` sang container backend).

### 5. Chạy dự án
Chỉ cần chạy một lệnh duy nhất:
```bash
docker-compose up -d --build
```
Hệ thống sẽ tự động cài SQL Server, build Backend, build Frontend, và mở cổng 80 cho người dùng truy cập. Bạn có thể trỏ Tên Miền (Domain) của mình vào địa chỉ IP của VPS này là xong.

---
### 💡 Lời khuyên chốt lại
- Nếu bạn muốn **nhanh, dễ làm, miễn phí** để làm đồ án/demo: **Chọn Phương án 1 (Azure SQL + Render + Vercel).**
- Nếu bạn muốn **chuyên nghiệp, bảo mật, chịu tải cao** để phát hành thật: **Chọn Phương án 2 (VPS Ubuntu + Docker).**
