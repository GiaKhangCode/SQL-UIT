-- 6.31: Tính tổng số sản phẩm do “Trung Quoc” sản xuất.
-- Bai tap 1, phan III, cau 31 trong PDF.
SELECT COUNT(*) AS SO_SAN_PHAM_TRUNG_QUOC
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc';
