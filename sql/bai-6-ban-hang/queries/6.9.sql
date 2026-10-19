-- 6.9: In ra số hóa đơn, trị giá các hóa đơn do nhân viên có tên “Nguyen Van B” lập trong ngày 28/10/2006.
-- Bai tap 1, phan III, cau 9 trong PDF.
SELECT hd.SOHD, hd.TRIGIA
FROM HOADON AS hd
INNER JOIN NHANVIEN AS nv ON nv.MANV = hd.MANV
WHERE nv.HOTEN = 'Nguyen Van B' AND hd.NGHD >= '20061028' AND hd.NGHD < '20061029'
ORDER BY hd.SOHD;
