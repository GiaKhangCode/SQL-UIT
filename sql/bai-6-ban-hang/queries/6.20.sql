-- 6.20: Có bao nhiêu sản phẩm khác nhau được bán ra trong năm 2006.
-- Bai tap 1, phan III, cau 20 trong PDF.
SELECT COUNT(DISTINCT ct.MASP) AS SO_SAN_PHAM_DA_BAN
FROM CTHD AS ct
INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101';
