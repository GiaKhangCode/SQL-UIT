# Ngôn ngữ Việt–Anh

Cấu hình đã tách theo khu vực. Không còn dồn tất cả bản dịch vào `vi.ts`.

```text
i18n/
  index.ts                  # Cấu hình mặc định, locale, tra cứu và nội suy
  types.ts                  # Language, TranslationScope, Translator
  messages.ts               # Mẫu thông báo có tên, mã hoặc số lượng
  locales/
    en.ts                   # Câu tiếng Anh gốc, cùng tập khóa với tiếng Việt
    vi/
      common.ts             # Header, trạng thái, thành phần dùng chung
      student.ts            # Các trang sinh viên
      teacher.ts            # Các trang giảng viên
      admin.ts              # Các trang quản trị
      auth.ts               # Đăng nhập, đăng ký, khôi phục mật khẩu
      workspace.ts          # Không gian làm bài DDL/DML/SQL và công cụ
      index.ts              # Tập hợp các nhóm tiếng Việt
```

Mặc định dùng tiếng Việt. Trong header, mở menu tài khoản rồi chọn Việt/Anh ở mục **Ngôn ngữ**, ngay dưới **Giao diện**. Trang đăng nhập vẫn có nút quả địa cầu riêng. `LanguageProvider` lưu lựa chọn ở `sql-practice:language`, cập nhật `document.lang` và cung cấp locale `vi-VN` / `en-US`.

## Phạm vi đã rà

| Khu vực | Trang và thành phần |
| --- | --- |
| Sinh viên | Tổng quan, luyện tập, danh sách lớp/bài tập, chi tiết lớp và bài tập, làm bài được giao, danh sách/chi tiết cuộc thi, lịch sử và chi tiết bài nộp |
| Giảng viên | Thư viện bài toán, tạo/sửa bài toán, phần luyện tập, danh sách/tạo/sửa bài tập và cuộc thi, lớp và thành viên, kết quả, bài nộp và chấm thủ công |
| Admin | Tổng quan, chi tiết hoạt động, tài khoản, sửa tài khoản, duyệt/từ chối giảng viên, quyền hạn, học phần/lớp, sửa lớp, thành viên, phân công giảng viên, danh mục luyện tập, nhập CSV |
| Workspace | Phần DDL, DML, SQL, câu hỏi, lược đồ, sơ đồ quan hệ, kết quả, gợi ý, ghi chú, AI, bố cục, đồng hồ, nộp bài thi và bảng điểm |
| Dùng chung | Header ba vai trò, thông báo, chuỗi học, trạng thái, hộp thoại, lịch, đăng nhập/đăng ký, chọn ảnh bìa |

Phần dịch áp dụng cho nội dung giao diện được định nghĩa trong frontend và các mẫu thông báo hệ thống đã biết. Tên người dùng, tên lớp/bài, chủ đề SQL, đề bài, hướng dẫn do giảng viên nhập, dữ liệu truy vấn, mã SQL và nội dung trò chuyện giữ nguyên bản gốc. Lỗi hoặc nội dung tự do từ máy chủ chưa có trong từ điển được hiển thị nguyên văn.

## Thêm bản dịch

Trong trang giảng viên:

```tsx
const { t, locale } = useLanguage("teacher");
return <button><TranslatedText>{t("Save draft")}</TranslatedText></button>;
```

Bổ sung câu tương ứng vào `locales/vi/teacher.ts`:

```ts
"Save draft": "Lưu nháp",
```

Câu tiếng Anh là khóa dùng chung cho hai ngôn ngữ. `en.ts` tạo tập khóa tiếng Anh từ các nhóm tiếng Việt nên không cần lặp lại cả hai bảng. Thứ tự tra cứu là nhóm được yêu cầu, `common`, rồi các nhóm còn lại để thành phần dùng chung có thể hiển thị nhãn được truyền từ trang cha. Khi chưa có bản dịch, hiển thị câu gốc.

Với câu chứa dữ liệu, dùng tham số thay vì ghép câu đã dịch:

```tsx
t("Page {page} of {total}", { page: currentPage, total: pageCount })
```

Tên/mã được chèn vào giữ nguyên. Các async handler cũ lưu câu tiếng Anh vào state được hỗ trợ bởi danh sách mẫu rõ ràng trong `messages.ts`, nhờ đó đổi ngôn ngữ vẫn cập nhật thông báo đã có. Không thay thế từ tùy tiện trong dữ liệu API.

Giá trị form và API phải giữ nguyên:

```tsx
<option value="Public">{t("Public")}</option>
```

Không dùng bản dịch làm `value`, route, key, tên cột dữ liệu hoặc điều kiện so sánh trạng thái.

## Hiệu ứng đổi chữ trên toàn giao diện

`TranslatedText` bọc chữ giao diện ở cả ba vai trò, gồm nhãn, tiêu đề bảng, trạng thái, phân trang, thông báo, hộp thoại và nút. `LanguageText` ở header dùng cùng bộ điều phối này. Ví dụ:

```tsx
import { TranslatedText } from "../../components/TranslatedText";

<TranslatedText>{t("New assignment")}</TranslatedText>
```

`LanguageProvider` giữ chữ cũ trong giai đoạn đi ra, sau đó cập nhật ngôn ngữ một lần cho toàn ứng dụng và cho chữ mới đi vào. Bộ điều phối trong `i18n/motion.ts` dùng một đồng hồ chung cho từng giai đoạn, không tạo timer hay ResizeObserver riêng cho mỗi nhãn.

- Một IntersectionObserver chung theo dõi vùng nhìn thấy, bao gồm phần bị cắt trong bảng cuộn.
- Tối đa 160 nhãn đang hiển thị chạy hiệu ứng mỗi lần; các nhãn còn lại đổi trực tiếp khi ngôn ngữ được cập nhật.
- Độ trễ được giới hạn 90 ms; chữ cũ đi ra trong 260 ms, chữ mới đi vào trong 380 ms.
- Chỉ nhãn ngắn trong nút hoặc menu được co giãn chiều rộng (350 ms). Nội dung dài vẫn được xuống dòng; không chạy hiệu ứng đổi chiều rộng trên ô bảng.
- Các thuộc tính trợ năng, placeholder, ô nhập và option của select gốc đổi trực tiếp. Không chèn phần tử animation vào option, editor, Markdown hay SQL.
- Hiệu ứng chỉ kích hoạt khi chọn ngôn ngữ. Tìm kiếm, phân trang và cập nhật dữ liệu thông thường không tạo chuyển động đổi chữ.
- Đổi ngôn ngữ liên tục sẽ hủy yêu cầu cũ; chọn lại ngôn ngữ hiện tại sẽ hủy lần đổi đang chờ. Bật giảm chuyển động hoặc ẩn tab sẽ kết thúc ngay chuyển động và cập nhật lựa chọn mới nhất.

Các phần tử bọc văn bản không tạo bản sao nội dung cho trình đọc màn hình. CSS chỉ áp dụng cho các class `i18n-motion-*`; chế độ sáng/tối dùng màu và font hiện có. Chưa đo FPS trên trình duyệt thực tế, vì vậy giới hạn trên là biện pháp kiểm soát tải, không phải cam kết hiệu năng trên mọi thiết bị.

## Kiểm tra

```bash
npm test
npm run test:i18n
npm run test:language-motion
npm run test:language-client
npm run test:workspace
npm run build
```

`test:i18n` kiểm tra tập khóa hai ngôn ngữ, tham số, mẫu thông báo, nhãn từ cấu hình, render Việt–Anh của các phần đại diện ba vai trò, giữ nguyên SQL/dữ liệu và rà các file giao diện. `scripts/i18n-audit.mjs` phát hiện chữ JSX/thuộc tính còn viết trực tiếp, khóa dịch thiếu và option có giá trị bị dịch. SQL mẫu, mã, tên tệp, email mẫu và ký hiệu kỹ thuật được loại trừ có chủ đích. `test:language-motion` kiểm tra đồng hồ chung, giới hạn nhãn, vùng cuộn, co giãn chiều rộng, đổi liên tục, giảm chuyển động và dọn tài nguyên. Bộ rà nguồn cũng kiểm tra nhãn dịch có wrapper hiệu ứng và không chèn wrapper vào option. Đây là rà nguồn và kiểm tra render; không thay thế kiểm tra mọi trạng thái trên trình duyệt.

Kiểm tra trực quan đầy đủ sáng/tối, mobile, bố cục khi nhãn dài và thao tác bàn phím chưa thực hiện được trong phiên này vì công cụ không có trình duyệt khả dụng.

## Menu Giao diện và Ngôn ngữ

`components/AppearanceSettings.tsx` là phần cài đặt chung trong menu tài khoản của sinh viên, giảng viên và admin. Nút hiện chế độ sáng/tối hiện tại, biểu tượng mặt trời/mặt trăng và một công tắc; bên dưới là một nút gạt Ngôn ngữ cùng kiểu, hiển thị Tiếng Việt hoặc English. Bấm để chuyển Việt ↔ Anh. Escape vẫn đóng menu và trả focus về tài khoản; Tab/Enter/Space hoạt động với cả hai nút gạt.

Đổi theme dùng `utils/themeReveal.ts` và `ThemeContext`: tạo vòng tròn từ tâm biểu tượng, tính bán kính đủ phủ cả bốn góc viewport, chuyển trong 700 ms với đường cong `cubic-bezier(.65,0,.35,1)`. Biểu tượng xoay trong 600 ms. Toàn bộ màu vẫn lấy từ hệ biến sáng/tối hiện có; lựa chọn lưu ở `sql-practice:theme`.

Triển khai dùng [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) để chụp chuyển cảnh của trang hiện tại, giữ nguyên editor, form và vị trí cuộn. Không tạo hai bản sao cây ứng dụng như demo. Trình duyệt thiếu API, tab bị ẩn hoặc bật giảm chuyển động sẽ đổi theme ngay. Yêu cầu đổi liên tục, snapshot lỗi và cleanup được kiểm tra bằng `npm run test:theme-reveal`. CSS snapshot chỉ áp dụng khi root có class tạm `u219-theme-reveal`; những style còn lại giới hạn trong `u219-*`.

Các file của phần này: `components/AppearanceSettings.tsx`, `.css`, `context/ThemeContext.tsx`, `utils/themeReveal.ts`, `components/RoleHeader.tsx`, `components/LanguageSwitch.css`, `i18n/locales/vi/common.ts` và các test liên quan. Kiểm tra render có cả hai theme và hai ngôn ngữ; chưa kiểm tra trực quan chuyển cảnh trên trình duyệt trong phiên này.

## Đồng bộ khi cập nhật code lúc đang chạy dev

`context/stableContext.ts` giữ định danh context qua `import.meta.hot.data`. Ngôn ngữ, hiệu ứng chữ và theme cùng dùng cơ chế này để consumer đã mount không tách khỏi provider sau khi Vite thay module.

`test:language-client` dùng React DOM trong JSDOM, bấm nút đổi Việt → Anh → Việt trên cây giao diện đang mount, kiểm tra menu, navigation, phần chọn DDL/DML/SQL và consumer được memo hóa. Test cũng mô phỏng nạp lại module context, kiểm tra lựa chọn đã lưu, `document.lang` và giữ nguyên phần tử/input bản nháp. Đây là kiểm tra tương tác DOM, không đo FPS hoặc kiểm tra bố cục trình duyệt.

Sau lần nâng cấp từ context cũ, tải lại trang một lần để bỏ các module cũ đã được giữ trong tab. Không cần xóa localStorage hoặc bản nháp.
