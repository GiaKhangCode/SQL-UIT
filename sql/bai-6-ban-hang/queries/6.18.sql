-- 6.18: Tìm số hóa đơn trong năm 2006 đã mua ít nhất tất cả các sản phẩm do Singapore sản xuất.
-- Bai tap 1, phan III, cau 18 trong PDF.
SELECT hd.SOHD
FROM HOADON AS hd
WHERE hd.NGHD >= '20060101' AND hd.NGHD < '20070101'
  AND NOT EXISTS (
      SELECT 1 FROM SANPHAM AS sp
      WHERE sp.NUOCSX = 'Singapore' AND NOT EXISTS (
          SELECT 1 FROM CTHD AS ct WHERE ct.SOHD = hd.SOHD AND ct.MASP = sp.MASP
      )
  )
ORDER BY hd.SOHD;
