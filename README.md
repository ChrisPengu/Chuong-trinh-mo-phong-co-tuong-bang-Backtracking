# Kỳ Thập - Cờ tướng với AI Backtracking

> Bài tập lớn môn Trí tuệ nhân tạo: xây dựng game cờ tướng chạy trên trình duyệt, trong đó phần mình tập trung nhất là thuật toán tìm nước đi cho máy.

Kỳ Thập có hai chế độ: hai người chơi trên cùng một thiết bị và người chơi đấu với AI. Mình chọn làm ứng dụng web thuần JavaScript để phần luật cờ, tìm kiếm và giao diện có thể đọc trực tiếp trong mã nguồn, không phụ thuộc vào engine cờ hay dịch vụ AI bên ngoài. AI không được “dạy sẵn” các nước khai cuộc: mỗi lượt máy tự sinh nước hợp lệ, thử các nhánh tiếp theo, lượng giá rồi hoàn tác bàn cờ để xét nhánh khác.

## Mục lục

- [Chạy thử trên máy](#chạy-thử-trên-máy)
- [Cách chơi và các chức năng](#cách-chơi-và-các-chức-năng)
- [AI tìm nước đi như thế nào?](#ai-tìm-nước-đi-như-thế-nào)
- [Tổ chức mã nguồn](#tổ-chức-mã-nguồn)
- [Kiểm thử và thế cờ mẫu](#kiểm-thử-và-thế-cờ-mẫu)
- [Âm thanh, hiệu ứng và tài nguyên](#âm-thanh-hiệu-ứng-và-tài-nguyên)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)
- [Đưa lên GitHub](#đưa-lên-github)

## Chạy thử trên máy

**Yêu cầu:** Node.js từ phiên bản 18 trở lên và một trình duyệt hiện đại có hỗ trợ JavaScript module, Canvas, Web Worker. Dự án không dùng thư viện npm bên ngoài, vì vậy sau khi tải mã nguồn về không cần chạy `npm install`.

Trên PowerShell (Windows):

```powershell
cd "duong-dan-den-thu-muc-du-an"
npm.cmd start
```

Trên macOS hoặc Linux, dùng `npm start` thay cho `npm.cmd start`. Mở địa chỉ mà terminal in ra, thường là `http://127.0.0.1:4173`. Nếu cổng 4173 đã có chương trình khác dùng, server sẽ tự thử cổng tiếp theo và in địa chỉ mới. Hãy dùng **đúng địa chỉ được in**, không cần tắt một server cũ chỉ để giải phóng cổng.

Không nên mở `index.html` bằng đường dẫn `file://`: Web Worker dạng module và tệp âm thanh cần được phục vụ qua HTTP. Muốn dừng server, nhấn `Ctrl+C` trong terminal đang chạy nó.

Chạy kiểm thử:

```powershell
npm.cmd test
```

Nếu terminal báo `npm` không tồn tại, hãy kiểm tra Node.js đã được cài và mở lại terminal. Nếu không nghe tiếng ngay khi vừa tải trang thì đó là cơ chế chặn autoplay của trình duyệt; âm thanh bắt đầu sau thao tác đầu tiên của người chơi. Nút **Âm thanh** ở góc trên cho phép bật/tắt tiếng.

## Cách chơi và các chức năng

Khi vào trang, chọn **Đấu với máy** hoặc **Hai người**. Ở chế độ đấu máy, chọn bên Đỏ/Đen và độ khó trước khi bắt đầu ván mới. Đỏ đi trước theo bàn cờ mặc định. Bấm vào quân của bên đang tới lượt để xem các ô có thể đi, rồi bấm ô đích để thực hiện nước đi. Quân đối phương ở ô đích sẽ bị ăn nếu nước đó hợp lệ.

Các thao tác chính:

| Chức năng | Công dụng |
| --- | --- |
| **Ván mới** | Trở về bàn cờ khai cuộc và bắt đầu ván mới. |
| **Đi lại** | Ở chế độ hai người, hoàn tác một nước; khi đấu máy, quay về trước nước gần nhất của người chơi, gồm cả nước đáp của AI nếu đã có. |
| **Phân tích** | Nhờ AI tìm một nước đề xuất cho bên đang tới lượt; hiện mũi tên, điểm lượng giá và biến chính dự kiến. Đây là gợi ý, không tự đánh thay người chơi. |
| **Xoay bàn** | Đổi hướng nhìn bàn cờ, hữu ích khi cầm quân Đen hoặc chơi hai người. |
| **Thế cờ kiểm thử** | Nạp nhanh bàn cờ khai cuộc, thế chiếu bí trong một nước hoặc thế đã kết thúc. |
| **Âm thanh** | Bật/tắt SFX; lựa chọn được lưu trong trình duyệt. |

Giao diện còn có lịch sử nước đi, thông báo chiếu/kết thúc ván và số liệu lượt tìm kiếm gần nhất của AI: độ sâu hoàn tất, số nút đã duyệt và thời gian xử lý. Trạng thái **AI đang suy nghĩ** nằm phía trên bàn cờ, không che các ô cờ. AI chạy trong Web Worker để giao diện không bị đứng khi tìm kiếm.

### Những luật đã cài đặt

Bàn cờ gồm 10 hàng, 9 cột và 32 quân ban đầu. Engine xử lý cách đi cơ bản của Tướng, Sĩ, Tượng, Mã, Xe, Pháo và Tốt, bao gồm các điểm dễ sai như chân Mã, mắt Tượng, Pháo cần đúng một ngòi khi ăn, Tốt qua sông mới được đi ngang và hai Tướng không được nhìn thẳng mặt nhau. Một nước chỉ được chấp nhận nếu sau khi đi, Tướng bên mình không bị chiếu. Hết nước hợp lệ là thua, kể cả trường hợp không đang bị chiếu.

Để ván mô phỏng không kéo dài vô hạn, chương trình xử hòa khi cùng trạng thái bàn cờ và bên tới lượt xuất hiện ba lần, hoặc khi lịch sử đạt 200 nước. Phần xử hòa này là quy ước của đồ án, chưa thay thế toàn bộ quy tắc trường chiếu/trường tróc trong thi đấu chính thức.

## AI tìm nước đi như thế nào?

Phần AI nằm chủ yếu trong `src/ai.js`; luật và sinh nước hợp lệ nằm ở `src/engine.js`. Mỗi nút của cây tìm kiếm biểu diễn một thế cờ. Điểm quan trọng của **backtracking** là không tạo một bản sao bàn cờ cho mọi nhánh: engine thực hiện nước đi trên bàn cờ hiện tại, duyệt nhánh con, rồi **hoàn tác đúng quân đã đi và quân đã bị ăn** để thử nước tiếp theo.

```text
tim_kiem(ban_co, ben_di, do_sau, alpha, beta):
    neu den_la: tra_ve luong_gia_hoac_tim_an_quan_tiep
    tot_nhat = -vo_cung
    voi moi nuoc_hop_le da_sap_xep:
        quan_bi_an = thuc_hien(nuoc)
        diem = -tim_kiem(ban_co, doi_thu, do_sau - 1, -beta, -alpha)
        hoan_tac(nuoc, quan_bi_an)       <- backtracking
        cap_nhat(tot_nhat, alpha, diem)
        neu alpha >= beta: dung_nhanh   <- alpha-beta pruning
    tra_ve tot_nhat
```

Mình dùng **Negamax** vì hai bên có mục tiêu đối nghịch: điểm tốt cho bên này là điểm xấu cho bên kia. Bản thân backtracking giúp duyệt cây; các kỹ thuật sau giúp cây đủ nhỏ để AI phản hồi trong thời gian chơi thực tế:

1. **Iterative deepening:** tìm lần lượt ở độ sâu 1, 2, 3… Nếu hết ngân sách thời gian giữa một vòng, AI dùng kết quả của vòng sâu nhất đã hoàn tất.
2. **Alpha–beta pruning:** bỏ nhánh không thể làm thay đổi lựa chọn hiện tại.
3. **Sắp xếp nước đi:** ưu tiên nước lấy từ bảng nhớ, nước ăn quân theo giá trị quân bị ăn so với quân tấn công, rồi tới các *killer moves*. Sắp xếp tốt giúp alpha–beta cắt được nhiều nhánh hơn.
4. **Transposition table:** lưu điểm, độ sâu, loại biên và nước tốt nhất của thế đã xét. Khóa hiện tại là chuỗi mô tả bàn cờ kèm bên tới lượt.
5. **Quiescence search:** khi chạm độ sâu giới hạn, xét thêm một số nước ăn quân để không dừng ngay giữa chuỗi đổi quân.
6. **Hàm lượng giá:** cộng giá trị vật chất và điểm vị trí, chẳng hạn độ tiến của Tốt, vị trí trung tâm của Mã/Pháo và vị trí của Tướng.

AI trả về nước chọn, điểm lượng giá, độ sâu hoàn tất, số nút, số lần cắt nhánh và một **principal variation** (chuỗi nước dự kiến từ bảng nhớ). Biến chính chỉ mô tả nhánh AI đang đánh giá; đối thủ không bắt buộc phải đi theo chuỗi này. Nút **Phân tích** sử dụng cùng engine, nhưng yêu cầu mức tìm kiếm `hard` cho lượt gợi ý.

| Mức | Độ sâu tối đa | Ngân sách thời gian mục tiêu | Ghi chú |
| --- | ---: | ---: | --- |
| Dễ | 1 | 250 ms | Chọn ngẫu nhiên trong nhóm nước gần điểm nhau. |
| Vừa | 2 | 700 ms | Mức mặc định. |
| Khó | 4 | 1.800 ms | Xét chiến thuật sâu hơn. |
| Chuyên gia | 6 | 4.000 ms | Tìm sâu dần trong ngân sách lớn hơn. |

Đây là **giới hạn trên của độ sâu**, không phải cam kết AI luôn hoàn tất tới độ sâu đó. Thời gian thực tế còn tùy cấu hình máy và độ phức tạp thế cờ; bộ đếm thời gian được kiểm tra theo lô nút thay vì ngắt tuyệt đối ở đúng mili giây.

## Tổ chức mã nguồn

```text
.
├── index.html              Giao diện và các nút điều khiển
├── styles.css              Bố cục responsive, hoạt ảnh CSS
├── server.mjs              HTTP server nhỏ để chạy tại máy
├── src/
│   ├── engine.js           Biểu diễn bàn cờ, luật, nước hợp lệ, kết thúc ván
│   ├── ai.js               Lượng giá và thuật toán tìm kiếm
│   ├── ai-worker.js        Nhận yêu cầu tìm kiếm ở luồng riêng
│   ├── app.js              Trạng thái ván, Canvas, tương tác và VFX
│   ├── sound.js            Phát SFX, trộn mẫu âm với Web Audio
│   ├── experience.js       Màu, quỹ đạo và hiệu ứng riêng cho từng loại quân
│   └── scenarios.js        Các thế cờ mẫu
├── assets/sfx/             Mẫu âm .ogg và ghi chú nguồn/giấy phép
├── test/                   Kiểm thử tự động
├── .gitignore              Các loại tệp không đưa lên GitHub
├── Update.md               Nhật ký các thay đổi của đồ án
└── package.json            Lệnh start và test
```

Luồng một lượt đấu máy, tóm tắt:

```text
Người chơi chọn quân/ô đích
  -> app.js hỏi engine.js nước này có hợp lệ không
  -> cập nhật bàn cờ, hoạt ảnh và âm thanh
  -> app.js gửi bản sao trạng thái sang ai-worker.js
  -> ai.js tìm nước đi, worker trả kết quả
  -> app.js áp dụng nước AI và kiểm tra kết thúc ván
```

Trạng thái “AI đang suy nghĩ” được hiển thị ở thanh riêng trong lúc worker chạy. Kết quả worker có mã yêu cầu để phản hồi cũ không ghi đè một ván đã khởi tạo lại hoặc đã hoàn tác.

## Kiểm thử và thế cờ mẫu

Chạy `npm.cmd test` (hoặc `npm test` trên macOS/Linux). Bộ test sử dụng `node:test` có sẵn trong Node.js, không cần cài Jest/Vitest. Các nhóm kiểm thử hiện có:

- Luật đi quân và nước bất hợp lệ: chân Mã, mắt Tượng, ngòi Pháo, Tốt qua sông, hai Tướng nhìn mặt và tự để Tướng bị chiếu.
- Điều kiện kết thúc: chiếu bí, bí nước, các thế đã thắng.
- AI: lượng giá theo hai phía, tìm nước bắt Tướng/chiếu bí, tính hợp lệ của biến chính và thống kê tìm kiếm.
- Giao diện/âm thanh: khởi chạy và tương tác cơ bản, trạng thái AI không phủ bàn cờ, SFX có âm dự phòng và tải được mẫu âm cục bộ.

Trong giao diện, mục **Thế cờ kiểm thử** có năm lựa chọn: bàn cờ ban đầu; Đỏ hoặc Đen thắng trong một nước; Đỏ hoặc Đen đã thắng. Đây là cách nhanh nhất để trình diễn AI và màn kết thúc mà không phải đánh hết một ván.

## Âm thanh, hiệu ứng và tài nguyên

Trong mục **Trải nghiệm**, có ba mức **Tinh gọn / Cân bằng / Rực lửa** và thanh âm lượng 0–100%. Cả hai lựa chọn đều được lưu trên trình duyệt. Mặc định VFX ở mức Rực lửa, âm lượng 70%; người dùng bật giảm chuyển động trong hệ điều hành vẫn được ưu tiên.

Mỗi loại quân có một bộ màu, cao độ và dấu va chạm riêng. Xe có vệt lao xanh và các đường chém cong; Pháo tạo cầu năng lượng màu hổ phách cùng sóng xung kích elip; Mã bật cao, có vệt móng và nhịp âm kép. Tướng, Sĩ, Tượng và Tốt dùng những dấu ấn hình học và lớp âm nhẹ khác nhau. Chuyển động có nhịp lấy đà, chạm và đáp; tiếng ăn quân phát ở thời điểm chạm ô đích, quân bị ăn chỉ tan đi sau lúc đó. Thông báo sự kiện nằm dưới bàn cờ.

Mình bổ sung tiếng vang ngắn cho các âm ngân, phối riêng nhạc hiệu mở ván/thắng/thua và điều khiển âm lượng tổng. Nút tắt tiếng dừng cả các nguồn âm đã hẹn phát. Khi tạo ván mới hoặc hoàn tác, game hủy các nguồn âm đang chạy cùng hiệu ứng cũ. Bàn cờ được vẽ theo mật độ điểm ảnh của màn hình (tối đa 2×), giúp chữ và viền quân nét hơn trên màn hình HiDPI.

Để thử nhanh hiệu ứng ăn quân và kết thúc: chọn **Hai người**, nạp **Đỏ thắng trong 1 nước**, chọn Xe Đỏ ở cột giữa rồi ăn Tốt Đen ngay phía trên. Có thể đổi mức VFX để so sánh độ dày của hạt và lớp năng lượng.

Nước đi có vệt lướt và dư ảnh; ô đích xuất hiện vòng phù văn xoay trước khi quân đáp xuống. Ăn quân có thêm dải năng lượng, bụi, mảnh vỡ, tia sáng và phản ứng ở viền bàn cờ. Khi kết thúc ván, game dành một nhịp cho hiệu ứng kết thúc rồi mới mở bảng kết quả. Mở ván có vòng triệu hồi; dấu ấn trên bảng kết quả chuyển động nhẹ. Đây là hiệu ứng **lấy cảm hứng từ cảm giác arena/“Boom” của TFT**, tự vẽ bằng Canvas/CSS; dự án không dùng hình, âm thanh hay nhân vật của Riot. Game **không nháy phủ toàn màn hình** sau mỗi nước đi. Nếu hệ điều hành bật `prefers-reduced-motion`, hoạt ảnh di chuyển và các phản ứng trang trí được rút bỏ.

SFX kết hợp tiếng gỗ/kim loại/chuông thu sẵn với các lớp âm tổng hợp bằng Web Audio. Game đổi biến thể tiếng gỗ giữa các lượt, định vị stereo nhẹ theo cột trên bàn và có bộ giới hạn âm lượng. Nếu trình duyệt không tải hoặc giải mã được `.ogg`, phần âm tổng hợp vẫn phát được. Tám mẫu âm trong `assets/sfx/` được chọn từ [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), giấy phép **CC0**; danh sách tệp và cách dùng ghi tại [`assets/sfx/README.md`](assets/sfx/README.md). Font giao diện được tải từ Google Fonts; nếu offline, trình duyệt dùng font dự phòng.

## Giới hạn hiện tại

- Chưa cài đầy đủ thủ tục xử lý trường chiếu/trường tróc theo luật giải đấu; dùng hòa khi lặp trạng thái ba lần như đã nêu.
- Chưa có đồng hồ thi đấu, lưu/tải ván, đấu qua mạng hoặc opening book/endgame tablebase.
- Bảng nhớ dùng chuỗi bàn cờ; có thể nâng cấp lên Zobrist hashing để giảm chi phí tạo khóa.
- Đây là AI tìm kiếm theo hàm lượng giá viết tay, không phải mô hình machine learning và không có bảo đảm chơi ngang các engine cờ tướng chuyên nghiệp.

Mình giữ các giới hạn này trong README để người xem repo biết rõ phần nào đã hoàn thành và phần nào vẫn là hướng mở rộng, thay vì chỉ nhìn giao diện rồi hiểu nhầm dự án là một nền tảng thi đấu đầy đủ.

## Đưa lên GitHub

Chỉ cần đưa các tệp mã nguồn, test, tài liệu và `assets/sfx/` lên repo. Dự án hiện không có `node_modules` hay bộ thư viện npm cần cài. `.gitignore` chặn log, cache, bản build, file môi trường và tệp tải/giải nén tạm nếu chúng xuất hiện sau này. **Không xóa tám tệp `.ogg`**: chúng là âm thanh đang được game sử dụng. `Update.md` được giữ như nhật ký thay đổi.

Trước khi tạo commit, nên chạy lại:

```powershell
npm.cmd test
git status --short
```

Nếu muốn cho phép người khác tái sử dụng mã nguồn theo một giấy phép cụ thể, chủ repo cần tự chọn và thêm tệp `LICENSE`. CC0 của **mẫu âm Kenney** không tự động trở thành giấy phép cho toàn bộ mã nguồn.

## Tài liệu tham khảo

- [World Xiangqi Rules - World Xiangqi Federation](https://www.wxf-xiangqi.org/index.php?Itemid=291&id=269&lang=en&option=com_content&view=article): trang giới thiệu và đường dẫn tới bộ luật thi đấu.
- [Introduction to Xiangqi - World Xiangqi Federation](https://www.wxf-xiangqi.org/index.php?Itemid=304&id=208&lang=en&option=com_content&view=article): thuật ngữ và cách chơi.
- [Impact Sounds — Kenney](https://kenney.nl/assets/impact-sounds) và [trang hỗ trợ giấy phép của Kenney](https://kenney.nl/support): nguồn mẫu âm CC0.
- [Bringing the Festival to Life — Teamfight Tactics](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/bringing-the-festival-to-life/): tham khảo tư duy làm arena phản ứng với trận đấu, không sử dụng asset của Riot.
