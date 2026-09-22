# Nhật ký cập nhật

Tài liệu này ghi ngắn gọn các phần đã bổ sung sau bản cờ tướng và AI đầu tiên. Hướng dẫn sử dụng, kiến trúc và giới hạn chi tiết nằm trong [README.md](README.md).

## Giao diện và trải nghiệm

- [x] Thêm hoạt ảnh mở đầu, di chuyển quân và màn kết thúc ván; hỗ trợ chơi lại hoặc quay lại xem bàn cờ.
- [x] Đưa trạng thái “AI đang suy nghĩ” lên thanh riêng phía trên bàn cờ, không che quân.
- [x] Làm rõ VFX khi đi và ăn quân bằng dư ảnh, vòng chấn động, bụi, mảnh vỡ và tia sáng tại ô đích; bỏ hiệu ứng nháy phủ màn hình.
- [x] Tôn trọng tùy chọn giảm chuyển động (`prefers-reduced-motion`).
- [x] Bổ sung hiệu ứng lấy cảm hứng từ nhịp trình diễn TFT: vòng triệu hồi mở ván, phù văn ở ô đích, dải năng lượng khi ăn quân, viền bàn phản ứng với ăn/chiếu, và một nhịp kết thúc trước bảng kết quả. Tất cả được tự vẽ bằng Canvas/CSS, không dùng asset của Riot.

## Âm thanh

- [x] Phối âm Web Audio cho thao tác chọn, di chuyển, ăn quân, chiếu và kết thúc ván.
- [x] Thêm tám mẫu âm CC0 từ Kenney: ba biến thể tiếng gỗ cho nước thường, ba cho nước ăn quân, một điểm nhấn kim loại và một tiếng chuông. Có định vị stereo, giới hạn âm lượng và âm tổng hợp dự phòng khi tệp không tải được.
- [x] Giữ nút bật/tắt tiếng và ghi nhớ lựa chọn trong trình duyệt.
- [x] Thêm lớp âm dâng và tiếng chuông cho nhịp kết thúc ván; vẫn qua bộ giới hạn âm lượng.

## AI, thế cờ và kiểm thử

- [x] Thêm năm thế cờ nạp nhanh: khai cuộc, Đỏ/Đen thắng trong một nước, Đỏ/Đen đã thắng.
- [x] Thêm nút **Phân tích**: nước đề xuất, mũi tên trên bàn, lượng giá, độ sâu, số nút và chuỗi nước dự kiến.
- [x] Bổ sung kiểm thử cho luật đi quân, thế cờ mẫu, nước chiếu bí của AI, giao diện, vị trí thanh trạng thái và âm thanh.
