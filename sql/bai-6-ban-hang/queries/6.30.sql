-- 6.30: In ra danh sách 3 khách hàng có doanh số cao nhất (sắp xếp theo kiểu xếp hạng).
-- Bai tap 1, phan III, cau 30 trong PDF.
WITH XepHang AS (
    SELECT MAKH, HOTEN, DOANHSO,
           DENSE_RANK() OVER (ORDER BY DOANHSO DESC) AS HANG
    FROM KHACHHANG
)
SELECT MAKH, HOTEN, DOANHSO, HANG
FROM XepHang
WHERE HANG <= 3
ORDER BY HANG, MAKH;
