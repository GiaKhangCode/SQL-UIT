-- 6.22: Trị giá trung bình của tất cả các hóa đơn được bán ra trong năm 2006 là bao nhiêu?
-- Bai tap 1, phan III, cau 22 trong PDF.
SELECT AVG(TRIGIA) AS TRI_GIA_TRUNG_BINH
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101';
