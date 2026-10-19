-- 6.33: Với từng nước sản xuất, tìm giá bán cao nhất, thấp nhất, trung bình của các sản phẩm.
-- Bai tap 1, phan III, cau 33 trong PDF.
SELECT NUOCSX, MAX(GIA) AS GIA_CAO_NHAT, MIN(GIA) AS GIA_THAP_NHAT, AVG(GIA) AS GIA_TRUNG_BINH
FROM SANPHAM
GROUP BY NUOCSX
ORDER BY NUOCSX;
