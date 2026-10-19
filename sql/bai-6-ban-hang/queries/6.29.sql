-- 6.29: In ra danh sách các sản phẩm (MASP, TENSP) do “Trung Quoc” sản xuất có giá bằng 1 trong 3 mức giá cao nhất (của sản phẩm do “Trung Quoc” sản xuất).
-- Bai tap 1, phan III, cau 29 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE NUOCSX = 'Trung Quoc'
  AND GIA IN (
      SELECT DISTINCT TOP (3) GIA FROM SANPHAM
      WHERE NUOCSX = 'Trung Quoc' ORDER BY GIA DESC
  )
ORDER BY GIA DESC, MASP;
