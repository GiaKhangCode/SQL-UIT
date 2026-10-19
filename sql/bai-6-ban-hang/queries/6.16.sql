-- 6.16: In ra danh sách các sản phẩm (MASP,TENSP) không bán được trong năm 2006.
-- Bai tap 1, phan III, cau 16 trong PDF.
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE NOT EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE ct.MASP = sp.MASP AND hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
)
ORDER BY sp.MASP;
