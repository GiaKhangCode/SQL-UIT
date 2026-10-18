### 1. Schema trong SQL Server là cái gì?

Để dễ hình dung nhất:

- Hãy tưởng tượng **Database** là một **"Tòa nhà chung cư"**.
- Thì **Schema** chính là **"Căn hộ riêng"** của từng người trong tòa nhà đó.

Bình thường khi bạn viết lệnh:

```sql
CREATE TABLE KHACHHANG (...);
```

SQL Server sẽ tự động gán vào schema mặc định là `dbo` $\rightarrow$ tên đầy đủ là `[dbo].[KHACHHANG]`.

Nếu chỉ dùng mặc định `dbo`, khi 1.000 sinh viên cùng tạo bảng `KHACHHANG`, bảng của người này sẽ đè hoặc báo lỗi trùng tên với người kia!

---

### 2. Cơ chế dùng Schema mà chúng ta đã áp dụng

Thay vì phải tạo ra **1.000 Database riêng** (vừa tốn tiền Azure, vừa tốn RAM và làm treo server), chúng ta chỉ dùng **1 Database duy nhất**, nhưng chia ra các "căn hộ" riêng:

1. **Cấp "Căn hộ" định danh cho từng sinh viên khi vào thi:**
   Mỗi sinh viên khi vào phòng thi sẽ được tạo riêng một schema:
   $$\text{schema\_name} = \texttt{c\_[mã\_kỳ\_thi]\_[mã\_sinh\_viên]}$$
   _(Ví dụ: `c_01b1d220_4fa_6b8f1cca_502`)_

2. **Cơ chế âm thầm định tuyến (Query Rewriter):**
   - Sinh viên vẫn gõ câu lệnh SQL tự nhiên như bình thường:
     ```sql
     CREATE TABLE KHACHHANG (...);
     SELECT * FROM KHACHHANG;
     ```
   - Trước khi gửi đến SQL Server, Backend sẽ tự động gắn tiền tố schema của sinh viên đó vào:
     ```sql
     CREATE TABLE [c_01b1d220_4fa_6b8f1cca_502].[KHACHHANG] (...);
     SELECT * FROM [c_01b1d220_4fa_6b8f1cca_502].[KHACHHANG];
     ```

---

### 3. Vì sao giải pháp này tối ưu nhất cho 1.000+ sinh viên?

| Tiêu chí                  | Tạo 1.000 Database riêng                    | Dùng 1.000 Schema trên 1 Database (Giải pháp hiện tại)                                                                                     |
| :------------------------ | :------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Tốc độ khởi tạo**       | Rất chậm (mất 5 - 10 giây/database)         | **Cực nhanh (chỉ mất 1 - 2 mili-giây)**                                                                                                    |
| **Tiêu tốn RAM & CPU**    | Dễ sập server khi có 1.000 DB chạy cùng lúc | **Gần như không tốn thêm tài nguyên**                                                                                                      |
| **Tính cô lập (Sandbox)** | Độc lập                                     | **Độc lập tuyệt đối**: Sinh viên A có `DROP TABLE` hay sửa dữ liệu thì chỉ ảnh hưởng trong schema của A, sinh viên B không hề bị ảnh hưởng |
| **Dọn dẹp sau kỳ thi**    | Phải drop 1.000 DB, dễ lỗi khóa file        | **Cực kỳ gọn nhẹ**: Chỉ cần xóa schema là xong                                                                                             |
