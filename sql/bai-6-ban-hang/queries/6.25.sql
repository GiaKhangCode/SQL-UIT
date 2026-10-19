-- 6.25: Tìm họ tên khách hàng đã mua hóa đơn có trị giá cao nhất trong năm 2006.
-- Bai tap 1, phan III, cau 25 trong PDF.
SELECT DISTINCT kh.HOTEN
FROM KHACHHANG AS kh
INNER JOIN HOADON AS hd ON hd.MAKH = kh.MAKH
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
  AND hd.TRIGIA = (
      SELECT MAX(TRIGIA) FROM HOADON
      WHERE NGHD >= '20060101' AND NGHD < '20070101'
  )
ORDER BY kh.HOTEN;
