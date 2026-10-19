-- 6.37: Tìm hóa đơn có mua ít nhất 4 sản phẩm khác nhau.
-- Bai tap 1, phan III, cau 37 trong PDF.
SELECT SOHD
FROM CTHD
GROUP BY SOHD
HAVING COUNT(DISTINCT MASP) >= 4
ORDER BY SOHD;
