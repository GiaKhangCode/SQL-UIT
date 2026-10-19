-- 6.43: Tìm nước sản xuất sản xuất ít nhất 3 sản phẩm có giá bán khác nhau.
-- Bai tap 1, phan III, cau 43 trong PDF.
SELECT NUOCSX
FROM SANPHAM
GROUP BY NUOCSX
HAVING COUNT(DISTINCT GIA) >= 3
ORDER BY NUOCSX;
