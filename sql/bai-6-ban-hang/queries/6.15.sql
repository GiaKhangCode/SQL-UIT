-- 6.15: In ra danh sách các sản phẩm (MASP,TENSP) không bán được.
-- Bai tap 1, phan III, cau 15 trong PDF.
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE NOT EXISTS (SELECT 1 FROM CTHD AS ct WHERE ct.MASP = sp.MASP)
ORDER BY sp.MASP;
