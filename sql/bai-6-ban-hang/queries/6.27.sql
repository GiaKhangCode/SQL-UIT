-- 6.27: In ra danh sách các sản phẩm (MASP, TENSP) có giá bán bằng 1 trong 3 mức giá cao nhất.
-- Bai tap 1, phan III, cau 27 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE GIA IN (SELECT DISTINCT TOP (3) GIA FROM SANPHAM ORDER BY GIA DESC)
ORDER BY GIA DESC, MASP;
