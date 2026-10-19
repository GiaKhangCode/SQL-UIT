-- 6.10: In ra danh sách các sản phẩm (MASP,TENSP) được khách hàng có tên “Nguyen Van A” mua trong tháng 10/2006.
-- Bai tap 1, phan III, cau 10 trong PDF.
SELECT sp.MASP, sp.TENSP
FROM SANPHAM AS sp
WHERE EXISTS (
    SELECT 1
    FROM CTHD AS ct
    INNER JOIN HOADON AS hd ON hd.SOHD = ct.SOHD
    INNER JOIN KHACHHANG AS kh ON kh.MAKH = hd.MAKH
    WHERE ct.MASP = sp.MASP AND kh.HOTEN = 'Nguyen Van A'
      AND hd.NGHD >= '20061001' AND hd.NGHD < '20061101'
)
ORDER BY sp.MASP;
