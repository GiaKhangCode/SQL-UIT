-- 6.8: In ra danh sách các khách hàng (MAKH, HOTEN) đã mua hàng trong ngày 1/1/2007.
-- Bai tap 1, phan III, cau 8 trong PDF.
SELECT kh.MAKH, kh.HOTEN
FROM KHACHHANG AS kh
WHERE EXISTS (
    SELECT 1 FROM HOADON AS hd
    WHERE hd.MAKH = kh.MAKH AND hd.NGHD >= '20070101' AND hd.NGHD < '20070102'
)
ORDER BY kh.MAKH;
