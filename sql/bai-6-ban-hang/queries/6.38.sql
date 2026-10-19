-- 6.38: Tìm hóa đơn có mua 3 sản phẩm do “Viet Nam” sản xuất (3 sản phẩm khác nhau).
-- Bai tap 1, phan III, cau 38 trong PDF.
SELECT ct.SOHD
FROM CTHD AS ct
INNER JOIN SANPHAM AS sp ON sp.MASP = ct.MASP
WHERE sp.NUOCSX = 'Viet Nam'
GROUP BY ct.SOHD
HAVING COUNT(DISTINCT ct.MASP) = 3
ORDER BY ct.SOHD;
