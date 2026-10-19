-- 6.35: Tính tổng số lượng của từng sản phẩm bán ra trong tháng 10/2006.
-- Bai tap 1, phan III, cau 35 trong PDF.
SELECT sp.MASP, sp.TENSP, SUM(ct.SL) AS TONG_SO_LUONG
FROM SANPHAM AS sp
INNER JOIN CTHD AS ct ON ct.MASP = sp.MASP
INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
WHERE hd.NGHD >= '20061001' AND hd.NGHD < '20061101'
GROUP BY sp.MASP, sp.TENSP
ORDER BY sp.MASP;
