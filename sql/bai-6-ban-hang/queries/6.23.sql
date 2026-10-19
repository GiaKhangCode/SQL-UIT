-- 6.23: Tính doanh thu bán hàng trong năm 2006.
-- Bai tap 1, phan III, cau 23 trong PDF.
SELECT SUM(TRIGIA) AS DOANH_THU_2006
FROM HOADON
WHERE NGHD >= '20060101' AND NGHD < '20070101';
