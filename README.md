# 🚀 Smart Auto Click-to-Accept (SAC)

![Giao diện Dashboard của Smart Auto Click-to-Accept](https://raw.githubusercontent.com/tomyxo/sac/main/Screenshot_demo.png)

**Smart Auto Click-to-Accept (SAC)** là một extension tự động click thông minh (Intelligent Auto-Clicker) dành cho các lập trình viên sử dụng mô hình AI-driven Development (như Antigravity). Nó hoạt động như một "Người gác cổng" tự động, giúp bạn phê duyệt các câu lệnh an toàn một cách chớp nhoáng, đồng thời ngăn chặn tuyệt đối các lệnh Terminal có nguy cơ phá hoại hệ thống.

---

## 🌟 Tính Năng Cốt Lõi

### 1. Phân Loại Rủi Ro Đa Tầng (Heuristic & Regex)
Extension sẽ tự động đọc nội dung câu lệnh mà AI chuẩn bị thực thi và phân loại vào 3 nhóm:
*   🟢 **Nhóm An Toàn (Safe)**: Các lệnh vô hại (vd: `ls`, `git status`, tạo/ghi file). Tự động click duyệt ngay lập tức (0ms).
*   🟡 **Nhóm Cảnh Giác (Medium)**: Các lệnh cần chú ý (vd: `npm install`, `git push`). Hiển thị cảnh báo đếm ngược (vd: 3 giây) kèm nút **Hủy tự động duyệt** để bạn có thời gian can thiệp.
*   🔴 **Nhóm Rủi Ro Cao (High Risk)**: Các lệnh nguy hiểm (vd: `rm -rf`, `format`). Extension sẽ **chặn đứng tự động duyệt**, yêu cầu bạn phải tự tay kiểm tra và click duyệt.

*(Hỗ trợ quét từ khóa bằng **Biểu thức chính quy - Regex** bằng cách bọc từ khóa trong cặp dấu `/.../`)*

### 2. Giao Diện Bảng Điều Khiển Kính Mờ (Glassmorphism UI)
Quản lý mọi thứ cực kỳ trực quan thông qua bảng Dashboard tích hợp sẵn trong VS Code:
*   Kéo thả để thêm/xóa lệnh giữa các nhóm rủi ro.
*   Thiết lập thời gian đếm ngược (timeout) cho từng nhóm.
*   Công tắc **Bật/Tắt (Toggle)** đồng bộ hóa toàn cầu ngay trong giao diện.

### 3. Tương Thích & Mở Rộng
*   **Export/Import JSON**: Dễ dàng sao lưu hoặc chia sẻ cấu hình các lệnh cấm của bạn thông qua **Clipboard** chỉ bằng 1 nút bấm.
*   **Cổng CDP Động**: Hỗ trợ tuỳ chỉnh cổng kết nối Chrome DevTools Protocol (Mặc định: 9000).

---

## ⚙️ Hướng Dẫn Cài Đặt & Sử Dụng

### 1. Kích hoạt tính năng gỡ lỗi của IDE
Vì extension này sử dụng giao thức CDP để "nhìn" vào các nút bấm của UI, bạn **BẮT BUỘC** phải khởi chạy IDE (Antigravity/VS Code) với một tham số gỡ lỗi.
*   Nhấn chuột phải vào Shortcut mở IDE của bạn ngoài Desktop -> Chọn **Properties**.
*   Tại ô **Target**, thêm đuôi này vào cuối cùng (cách ra 1 dấu cách): 
    `--remote-debugging-port=9000`
*   Khởi động lại IDE bằng Shortcut đó.

### 2. Truy cập Bảng Điều Khiển
Mở Command Palette (`Ctrl + Shift + P`) và gõ:
*   `Smart Auto Accept: Settings UI` -> Mở giao diện cấu hình chính.

💡 **Bật/Tắt nhanh**: Bạn có thể click trực tiếp vào trạng thái **`☑️ SAC: ON`** hoặc **`🚫 SAC: OFF`** ở thanh Status Bar (góc dưới cùng bên phải của VS Code) để bật/tắt nhanh extension mà không cần mở cài đặt.

### 3. Cấu hình nâng cao (Settings)
Nếu bạn thay đổi cổng `9000` thành số khác, hãy vào **VS Code Settings** (`Ctrl + ,`) -> Tìm `Smart Auto Accept: Cdp Port` và cập nhật lại số cổng tương ứng.

---

## 🛡️ Quyền Riêng Tư & An Toàn
Mã nguồn can thiệp vòng lặp `setInterval` thuần túy bằng Javascript, không sử dụng tài nguyên bên thứ 3 và không truyền dữ liệu ra khỏi máy cá nhân của bạn. Khả năng cô lập ngữ cảnh (Context Isolation) đảm bảo extension **không bao giờ bị báo động giả** khi AI chỉ đơn thuần viết chữ vào file code.

**Tác giả**: [tomy](https://toha.us)
**Website**: [https://toha.us](https://toha.us)
**Phiên bản**: 1.0.1
