-- 6.19: Có bao nhiêu hóa đơn không phải của khách hàng đăng ký thành viên mua?
-- Bai tap 1, phan III, cau 19 trong PDF.
SELECT COUNT(*) AS SO_HOA_DON_KHACH_VANG_LAI
FROM HOADON
WHERE MAKH IS NULL;
