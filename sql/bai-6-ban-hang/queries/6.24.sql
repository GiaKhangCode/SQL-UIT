-- 6.24: Tìm số hóa đơn có trị giá cao nhất trong năm 2006.
-- Bai tap 1, phan III, cau 24 trong PDF.
SELECT SOHD
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101'
  AND TRIGIA = (
      SELECT MAX(TRIGIA) FROM HOADON
      WHERE NGHD >= '20060101' AND NGHD < '20070101'
  )
ORDER BY SOHD;
