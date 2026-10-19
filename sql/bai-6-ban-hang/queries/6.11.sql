-- 6.11: Tìm các số hóa đơn đã mua sản phẩm có mã số “BB01” hoặc “BB02”.
-- Bai tap 1, phan III, cau 11 trong PDF.
SELECT DISTINCT SOHD
FROM CTHD
WHERE MASP IN ('BB01', 'BB02')
ORDER BY SOHD;
