-- 6.7: In ra các số hóa đơn, trị giá hóa đơn trong tháng 1/2007, sắp xếp theo ngày (tăng dần) và trị giá của hóa đơn (giảm dần).
-- Bai tap 1, phan III, cau 7 trong PDF.
SELECT SOHD, TRIGIA
FROM HOADON
WHERE NGHD >= '20070101' AND NGHD < '20070201'
ORDER BY NGHD ASC, TRIGIA DESC, SOHD ASC;
