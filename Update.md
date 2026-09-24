# Nhật ký cập nhật

Tài liệu này ghi ngắn gọn các phần đã bổ sung sau bản cờ tướng và AI đầu tiên. Hướng dẫn sử dụng, kiến trúc và giới hạn chi tiết nằm trong [README.md](README.md).

## Huyền Giới 3D — 24/09/2026

- [x] Sửa server lấy thư mục gốc theo vị trí `server.mjs`, không theo thư mục terminal; bổ sung mã bản dựng, endpoint `/__version`, header chống cache và kiểm thử HTML/CSS/JS thực tế khớp tệp trong checkout.
- [x] Thêm renderer Three.js/WebGL2 thật, giữ nguyên engine luật cờ và AI Backtracking/Negamax.
- [x] Sân đá nổi nhiều tầng, tinh thể hai phe, pháp trận ngoài sân, quân có độ dày/viền kim loại/bóng đổ; texture chữ và đá được tạo tại chỗ.
- [x] Nút **Hiển thị: Đấu trường 3D / Bàn cờ 2D** và **Góc nhìn: Phối cảnh / Nhìn từ trên** nằm ngay phía trên sân, không giấu trong menu phụ.
- [x] Raycasting chọn quân trước mặt bàn; vẫn chọn đúng khi xoay bàn, chuyển camera và hoàn tác.
- [x] Quân được triệu hồi so le khi mở ván; đường bay, cầu năng lượng Pháo, vệt Xe/Mã, mảnh vỡ 3D, đường chém, phù văn, khói cục bộ và cột năng lượng cho sự kiện quan trọng.
- [x] Giữ tiếng va chạm và hiệu ứng đồng bộ thời điểm chạm; không rung camera hoặc chớp sáng phủ màn hình.
- [x] Thêm reverb stereo tự sinh, bảy nhóm âm va chạm, nhịp trống mở ván và hòa âm thắng. Giữ tám sample CC0 và âm dự phòng.
- [x] Ba mức chất lượng điều chỉnh bloom, bóng, mật độ hạt và độ phân giải. Tôn trọng giảm chuyển động, không vẽ khi tab ẩn, giải phóng GPU khi chuyển 2D.
- [x] Tự chuyển 2D nếu không khởi tạo được WebGL hoặc mất ngữ cảnh GPU; không làm mất trạng thái ván.
- [x] Đóng gói thư viện cục bộ, kèm MIT license và package-lock; bỏ phụ thuộc tải font bên ngoài.
- [x] Thêm kiểm thử trình duyệt thật, ảnh desktop/mobile và các luồng tương tác; ảnh kiểm tra và node_modules không được đưa lên GitHub.
- [x] Cập nhật README về chạy game, build thư viện, vị trí tùy chọn, kiến trúc và giới hạn chất lượng hiện tại.

Đây là bước chuyển sang nền tảng trình diễn 3D, chưa phải chất lượng asset/cinematic của game thương mại. Những mục dưới ghi lịch sử các bản 2D trước; chúng vẫn được giữ làm chế độ tương thích.

## Giao diện và trải nghiệm

- [x] Thêm bộ hiệu ứng riêng cho bảy loại quân: Xe lao, Pháo bắn cầu năng lượng, Mã bật và đáp; màu, dấu va chạm và quỹ đạo được tách trong `src/experience.js`.
- [x] Đồng bộ âm/VFX với thời điểm chạm ô đích; quân bị ăn tan sau va chạm, quân đánh có nhịp nảy nhẹ khi đáp.
- [x] Thêm ba mức VFX, thanh âm lượng có lưu lựa chọn, thông báo sự kiện dưới bàn cờ, viền quân có chiều dày và hỗ trợ HiDPI tối đa 2×.

- [x] Thêm hoạt ảnh mở đầu, di chuyển quân và màn kết thúc ván; hỗ trợ chơi lại hoặc quay lại xem bàn cờ.
- [x] Đưa trạng thái “AI đang suy nghĩ” lên thanh riêng phía trên bàn cờ, không che quân.
- [x] Làm rõ VFX khi đi và ăn quân bằng dư ảnh, vòng chấn động, bụi, mảnh vỡ và tia sáng tại ô đích; bỏ hiệu ứng nháy phủ màn hình.
- [x] Tôn trọng tùy chọn giảm chuyển động (`prefers-reduced-motion`).
- [x] Bổ sung hiệu ứng lấy cảm hứng từ nhịp trình diễn TFT: vòng triệu hồi mở ván, phù văn ở ô đích, dải năng lượng khi ăn quân, viền bàn phản ứng với ăn/chiếu, và một nhịp kết thúc trước bảng kết quả. Tất cả được tự vẽ bằng Canvas/CSS, không dùng asset của Riot.

## Âm thanh

- [x] Thêm lớp âm đặc trưng cho Xe/Pháo/Mã và cao độ khác nhau cho các quân; tiếng vang ngắn, nhạc hiệu mở ván/thắng/thua riêng.
- [x] Dừng các nguồn âm đang phát/đã hẹn khi tắt tiếng hoặc khởi tạo lại ván; giữ bộ nén âm lượng chung.

- [x] Phối âm Web Audio cho thao tác chọn, di chuyển, ăn quân, chiếu và kết thúc ván.
- [x] Thêm tám mẫu âm CC0 từ Kenney: ba biến thể tiếng gỗ cho nước thường, ba cho nước ăn quân, một điểm nhấn kim loại và một tiếng chuông. Có định vị stereo, giới hạn âm lượng và âm tổng hợp dự phòng khi tệp không tải được.
- [x] Giữ nút bật/tắt tiếng và ghi nhớ lựa chọn trong trình duyệt.
- [x] Thêm lớp âm dâng và tiếng chuông cho nhịp kết thúc ván; vẫn qua bộ giới hạn âm lượng.

## AI, thế cờ và kiểm thử

- [x] Thêm năm thế cờ nạp nhanh: khai cuộc, Đỏ/Đen thắng trong một nước, Đỏ/Đen đã thắng.
- [x] Thêm nút **Phân tích**: nước đề xuất, mũi tên trên bàn, lượng giá, độ sâu, số nút và chuỗi nước dự kiến.
- [x] Bổ sung kiểm thử cho luật đi quân, thế cờ mẫu, nước chiếu bí của AI, giao diện, vị trí thanh trạng thái và âm thanh.
