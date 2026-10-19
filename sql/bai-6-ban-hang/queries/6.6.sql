-- 6.6: In ra các số hóa đơn, trị giá hóa đơn bán ra trong ngày 1/1/2007 và ngày 2/1/2007.
-- Bai tap 1, phan III, cau 6 trong PDF.
SELECT SOHD, TRIGIA
FROM HOADON
WHERE NGHD >= '20070101' AND NGHD < '20070103'
ORDER BY SOHD;
