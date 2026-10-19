-- 6.40: Tháng mấy trong năm 2006, doanh số bán hàng cao nhất ?
-- Bai tap 1, phan III, cau 40 trong PDF.
WITH DoanhThuThang AS (
    SELECT MONTH(NGHD) AS THANG, SUM(TRIGIA) AS DOANH_THU
    FROM HOADON
    WHERE NGHD >= '20060101' AND NGHD < '20070101'
    GROUP BY MONTH(NGHD)
)
SELECT THANG
FROM DoanhThuThang
WHERE DOANH_THU = (SELECT MAX(DOANH_THU) FROM DoanhThuThang)
ORDER BY THANG;
