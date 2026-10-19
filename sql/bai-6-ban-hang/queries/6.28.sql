-- 6.28: In ra danh sách các sản phẩm (MASP, TENSP) do “Thai Lan” sản xuất có giá bằng 1 trong 3 mức giá cao nhất (của tất cả các sản phẩm).
-- Bai tap 1, phan III, cau 28 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Thai Lan'
  AND GIA IN (SELECT DISTINCT TOP (3) GIA FROM SANPHAM ORDER BY GIA DESC)
ORDER BY GIA DESC, MASP;
