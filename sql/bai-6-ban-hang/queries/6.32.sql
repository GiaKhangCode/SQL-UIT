-- 6.32: Tính tổng số sản phẩm của từng nước sản xuất.
-- Bai tap 1, phan III, cau 32 trong PDF.
SELECT NUOCSX, COUNT(*) AS SO_SAN_PHAM
FROM SANPHAM
GROUP BY NUOCSX
ORDER BY NUOCSX;
