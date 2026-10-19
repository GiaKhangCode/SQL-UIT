-- 6.2: In ra danh sách các sản phẩm (MASP, TENSP) có đơn vị tính là “cay”, ”quyen”.
-- Bai tap 1, phan III, cau 2 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE DVT IN ('cay', 'quyen')
ORDER BY MASP;
