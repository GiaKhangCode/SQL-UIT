-- 6.1: In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quoc” sản xuất.
-- Bai tap 1, phan III, cau 1 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc'
ORDER BY MASP;
