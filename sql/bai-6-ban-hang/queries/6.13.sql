-- 6.13: Tìm các số hóa đơn mua cùng lúc 2 sản phẩm có mã số “BB01” và “BB02”, mỗi sản phẩm mua với số lượng từ 10 đến 20.
-- Bai tap 1, phan III, cau 13 trong PDF.
SELECT SOHD
FROM CTHD
WHERE MASP IN ('BB01', 'BB02') AND SL BETWEEN 10 AND 20
GROUP BY SOHD
HAVING COUNT(DISTINCT MASP) = 2
ORDER BY SOHD;
