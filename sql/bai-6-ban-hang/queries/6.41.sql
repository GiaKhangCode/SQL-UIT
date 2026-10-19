-- 6.41: Tìm sản phẩm (MASP, TENSP) có tổng số lượng bán ra thấp nhất trong năm 2006.
-- Bai tap 1, phan III, cau 41 trong PDF.
WITH LuongBan AS (
    SELECT sp.MASP, sp.TENSP, SUM(ct.SL) AS TONG_SO_LUONG
    FROM SANPHAM AS sp
    INNER JOIN CTHD AS ct ON ct.MASP = sp.MASP
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
    GROUP BY sp.MASP, sp.TENSP
)
SELECT MASP, TENSP
FROM LuongBan
WHERE TONG_SO_LUONG = (SELECT MIN(TONG_SO_LUONG) FROM LuongBan)
ORDER BY MASP;
