-- 6.3: In ra danh sách các sản phẩm (MASP,TENSP) có mã sản phẩm bắt đầu là “B” và kết thúc là “01”.
-- Bai tap 1, phan III, cau 3 trong PDF.
SELECT MASP, TENSP
FROM SANPHAM
WHERE MASP LIKE 'B%01'
ORDER BY MASP;
