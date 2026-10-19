-- 6.26: In ra danh sách 3 khách hàng (MAKH, HOTEN) có doanh số cao nhất.
-- Bai tap 1, phan III, cau 26 trong PDF.
SELECT TOP (3) MAKH, HOTEN
FROM KHACHHANG
ORDER BY DOANHSO DESC, MAKH ASC;
