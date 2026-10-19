-- 6.42: Mỗi nước sản xuất, tìm sản phẩm (MASP,TENSP) có giá bán cao nhất.
-- Bai tap 1, phan III, cau 42 trong PDF.
SELECT sp.NUOCSX, sp.MASP, sp.TENSP, sp.GIA
FROM SANPHAM AS sp
WHERE sp.GIA = (SELECT MAX(sp2.GIA) FROM SANPHAM AS sp2 WHERE sp2.NUOCSX = sp.NUOCSX)
ORDER BY sp.NUOCSX, sp.MASP;
