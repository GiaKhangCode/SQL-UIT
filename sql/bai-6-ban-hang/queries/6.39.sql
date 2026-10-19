-- 6.39: Tìm khách hàng (MAKH, HOTEN) có số lần mua hàng nhiều nhất.
-- Bai tap 1, phan III, cau 39 trong PDF.
WITH SoLanMua AS (
    SELECT kh.MAKH, kh.HOTEN, COUNT(hd.SOHD) AS SO_LAN_MUA
    FROM KHACHHANG AS kh
    LEFT JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
    GROUP BY kh.MAKH, kh.HOTEN
)
SELECT MAKH, HOTEN
FROM SoLanMua
WHERE SO_LAN_MUA = (SELECT MAX(SO_LAN_MUA) FROM SoLanMua)
ORDER BY MAKH;
