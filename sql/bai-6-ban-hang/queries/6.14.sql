-- 6.14: In ra danh sách các sản phẩm (MASP,TENSP) do “Trung Quoc” sản xuất hoặc các sản phẩm được bán ra trong ngày 1/1/2007.
-- Bai tap 1, phan III, cau 14 trong PDF.
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE sp.NUOCSX = 'Trung Quoc' OR EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE ct.MASP = sp.MASP AND hd.NGHD >= '20070101' AND hd.NGHD < '20070102'
)
ORDER BY sp.MASP;
