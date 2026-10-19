-- 6.44: Trong 10 khách hàng có doanh số cao nhất, tìm khách hàng có số lần mua hàng nhiều nhất.
-- Bai tap 1, phan III, cau 44 trong PDF.
WITH TopKhachHang AS (
    SELECT TOP (10) MAKH, HOTEN
    FROM KHACHHANG
    ORDER BY DOANHSO DESC, MAKH ASC
), SoLanMua AS (
    SELECT kh.MAKH, kh.HOTEN, COUNT(hd.SOHD) AS SO_LAN_MUA
    FROM TopKhachHang AS kh
    LEFT JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
    GROUP BY kh.MAKH, kh.HOTEN
)
SELECT MAKH, HOTEN
FROM SoLanMua
WHERE SO_LAN_MUA = (SELECT MAX(SO_LAN_MUA) FROM SoLanMua)
ORDER BY MAKH;
