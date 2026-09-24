# Kỳ Thập - Cờ tướng với AI Backtracking

> Bài tập lớn môn Trí tuệ nhân tạo: xây dựng game cờ tướng chạy trên trình duyệt, trong đó phần mình tập trung nhất là thuật toán tìm nước đi cho máy.

Kỳ Thập có hai chế độ: hai người chơi trên cùng một thiết bị và người chơi đấu với AI. Phần luật cờ và tìm kiếm được viết bằng JavaScript, không phụ thuộc vào engine cờ hay dịch vụ AI bên ngoài. Bản **Huyền Giới** bổ sung đấu trường 3D bằng Three.js; bàn cờ Canvas 2D vẫn được giữ để chạy trên thiết bị không hỗ trợ WebGL. AI không được “dạy sẵn” các nước khai cuộc: mỗi lượt máy tự sinh nước hợp lệ, thử các nhánh tiếp theo, lượng giá rồi hoàn tác bàn cờ để xét nhánh khác.

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

**Yêu cầu chạy game:** Node.js từ phiên bản 18 trở lên và trình duyệt hỗ trợ JavaScript module, Canvas, Web Worker. Đấu trường 3D cần **WebGL2** và bật tăng tốc phần cứng. Nếu không có WebGL2 hoặc GPU bị mất ngữ cảnh, game chuyển về 2D, không mất ván đang chơi.

Repo đã kèm bản Three.js đóng gói trong `vendor/three.js`, nên chỉ để chơi hoặc chạy unit test thì **không cần `npm install`**. Không xóa thư mục `vendor/` khi đưa lên GitHub. Công cụ phát triển/kiểm thử trình duyệt nên dùng Node.js 22 trở lên.

Trên PowerShell (Windows):

```powershell
cd "duong-dan-den-thu-muc-du-an"
npm.cmd start
```

Trên macOS hoặc Linux, dùng `npm start` thay cho `npm.cmd start`. Mở địa chỉ mà terminal in ra, thường là `http://127.0.0.1:4173`. Nếu cổng 4173 đã có chương trình khác dùng, server sẽ tự thử cổng tiếp theo và in địa chỉ mới. Hãy dùng **đúng địa chỉ được in**, không cần tắt một server cũ chỉ để giải phóng cổng.

Không nên mở `index.html` bằng đường dẫn `file://`: Web Worker dạng module và tệp âm thanh cần được phục vụ qua HTTP. Muốn dừng server, nhấn `Ctrl+C` trong terminal đang chạy nó.

Nếu vẫn thấy giao diện cũ “So tài trên cửu lộ, thập hoành”: kiểm tra URL terminal vừa in và mở đường dẫn **Mở bản mới** có `?v=huyen-gioi-3d-2026-09-24`. Bản mới có tiêu đề **Huyền Giới 3D** cùng mục **Hiển thị / Góc nhìn** phía trên sân. Địa chỉ `/__version` phải trả mã `huyen-gioi-3d-2026-09-24`; nếu không, cổng đó đang trỏ tới server khác/cũ. Server hiện luôn phục vụ thư mục chứa `server.mjs` và in rõ thư mục này khi khởi động.

Chạy kiểm thử:

```powershell
npm.cmd test
```

Nếu sửa phần 3D, cập nhật thư viện hoặc muốn chạy kiểm thử trên trình duyệt thật:

```powershell
npm.cmd ci
npm.cmd run build:vendor
npm.cmd run test:browser
```

`build:vendor` dùng esbuild để đóng gói Three.js và các pass hậu kỳ, đồng thời chép giấy phép MIT. `test:browser` dùng Chrome/Edge đã cài trên Windows, chạy headless bằng profile tạm riêng và server cổng trống; không đọc profile trình duyệt cá nhân. Có thể đặt `CHROME_PATH` nếu trình duyệt ở đường dẫn khác. Trên máy chưa có trình duyệt phù hợp, chạy `npx playwright install chromium`. Ảnh kiểm tra nằm trong `.artifacts/`, được git bỏ qua. Kiểm thử dùng bộ dựng hình phần mềm để chạy được cả trên máy CI, **không phải phép đo FPS của GPU thật**.

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
| **Hiển thị** | Ngay trên bàn cờ: chuyển giữa Đấu trường 3D và Bàn cờ 2D, giữ nguyên ván. |
| **Góc nhìn** | Chọn Phối cảnh hoặc Nhìn từ trên; độc lập với nút Xoay bàn. |
| **Trải nghiệm** | Bên dưới nút Ván mới: mức hiệu ứng và thanh âm lượng. |

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
├── arena.css               Giao diện Huyền Giới và bố cục sân 3D
├── server.mjs              HTTP server nhỏ để chạy tại máy
├── src/
│   ├── engine.js           Biểu diễn bàn cờ, luật, nước hợp lệ, kết thúc ván
│   ├── ai.js               Lượng giá và thuật toán tìm kiếm
│   ├── ai-worker.js        Nhận yêu cầu tìm kiếm ở luồng riêng
│   ├── app.js              Trạng thái ván, Canvas, tương tác và VFX
│   ├── arena3d.js          Three.js: sân, quân, raycasting, ánh sáng và VFX
│   ├── sound.js            Phát SFX, trộn mẫu âm với Web Audio
│   ├── experience.js       Màu, quỹ đạo và hiệu ứng riêng cho từng loại quân
│   └── scenarios.js        Các thế cờ mẫu
├── assets/sfx/             Mẫu âm .ogg và ghi chú nguồn/giấy phép
├── vendor/                 Three.js đóng gói + giấy phép MIT (cần commit)
├── scripts/                Build vendor và kiểm tra trình duyệt thật
├── test/                   Kiểm thử tự động
├── .gitignore              Các loại tệp không đưa lên GitHub
├── Update.md               Nhật ký các thay đổi của đồ án
├── package-lock.json       Khóa phiên bản thư viện để cài lại bằng npm ci
└── package.json            Lệnh chạy, build thư viện và kiểm thử
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
- Trình duyệt thật (`npm run test:browser`): khởi tạo WebGL, bấm nước hợp lệ trên bàn 3D, chọn quân khi xoay bàn, hoàn tác, đổi camera, ăn quân/chiếu bí, chuyển 2D↔3D, màn hình nhỏ và giảm chuyển động. Script báo lỗi nếu có lỗi JavaScript, shader hoặc tải tài nguyên.

Trong giao diện, mục **Thế cờ kiểm thử** có năm lựa chọn: bàn cờ ban đầu; Đỏ hoặc Đen thắng trong một nước; Đỏ hoặc Đen đã thắng. Đây là cách nhanh nhất để trình diễn AI và màn kết thúc mà không phải đánh hết một ván.

## Âm thanh, hiệu ứng và tài nguyên

Trong mục **Trải nghiệm**, có ba mức **Tinh gọn / Cân bằng / Rực lửa** và thanh âm lượng 0–100%. Cả hai lựa chọn đều được lưu trên trình duyệt. Mặc định VFX ở mức Rực lửa, âm lượng 70%; người dùng bật giảm chuyển động trong hệ điều hành vẫn được ưu tiên.

Đấu trường **Thiên Cơ Đài** là cảnh 3D thật: bàn đá nhiều tầng nổi giữa không gian tối, tinh thể ngọc/đỏ, quân có độ dày, bóng đổ, viền kim loại và hậu kỳ bloom ở mức Rực lửa. Chữ quân được tạo bằng CanvasTexture rồi đặt lên mặt quân, không dùng mô hình tải từ bên ngoài. Phép chiếu tia (raycasting) giúp chọn đúng quân trong cả hai góc nhìn; chọn quân có độ cao trước khi xét mặt bàn để tránh lệch do phối cảnh.

Mỗi loại quân có màu và quỹ đạo riêng: Xe lao thấp kèm đường chém; Pháo bay theo cung với cầu năng lượng, bụi khói; Mã bật cao; Tượng có lớp bụi đá/ngọc. Ăn quân có phù văn mặt đất, mảnh vỡ chuyển động trong không gian và ánh sáng cục bộ. Tướng/chiếu/kết thúc có thêm cột năng lượng. Chuyển động có nhịp lấy đà, chạm và đáp; tiếng ăn quân phát ở thời điểm chạm ô đích, quân bị ăn thu nhỏ và biến mất sau lúc đó. Thông báo sự kiện nằm dưới bàn cờ.

Phần SFX có tiếng gỗ thu sẵn làm điểm chạm, kết hợp âm riêng của từng quân: Pháo trầm và tiếng mảnh vỡ, Xe có âm kim loại, Mã có nhịp vó, Tượng có thân âm thấp/chuông ngọc, Sĩ có chùm âm cao, Tướng có chuông trầm. Mình thêm reverb stereo bằng impulse tự sinh để tạo cảm giác không gian, cùng nhạc hiệu mở ván/thắng/thua. Đây là âm thiết kế bằng Web Audio, không phải bản thu dàn nhạc hay âm của TFT.

Nút tắt tiếng dừng các nguồn âm đã hẹn phát và tắt đầu ra tổng. Khi tạo ván mới hoặc hoàn tác, game hủy nguồn âm cùng hiệu ứng cũ. Chất lượng 3D giới hạn mật độ điểm ảnh theo mức hiệu ứng (1× / 1,3× / 1,7×), tắt bloom ở mức Cân bằng, tắt thêm bóng đổ ở mức Tinh gọn. 2D giữ tối đa 2×. Renderer không vẽ khung hình khi tab bị ẩn; tài nguyên GPU được giải phóng khi chuyển sang 2D.

Để thử nhanh hiệu ứng ăn quân và kết thúc: chọn **Hai người**, nạp **Đỏ thắng trong 1 nước**, chọn Xe Đỏ ở cột giữa rồi ăn Tốt Đen ngay phía trên. Có thể đổi mức VFX để so sánh độ dày của hạt và lớp năng lượng.

Khi mở ván, các quân xuất hiện so le như được triệu hồi xuống sân. Khi kết thúc, game dành một nhịp trình diễn trước bảng kết quả. Đây là hướng **lấy cảm hứng từ cảm giác đấu trường huyền ảo**, tự dựng bằng Three.js/Canvas/CSS; dự án không dùng hình, âm thanh hay nhân vật của Riot và không phải bản sao TFT. Game **không nháy phủ toàn màn hình** sau mỗi nước đi. Nếu hệ điều hành bật `prefers-reduced-motion`, chuyển động quân, hạt và các phản ứng trang trí được rút bỏ.

SFX đổi biến thể tiếng gỗ giữa các lượt, định vị stereo nhẹ theo cột trên bàn và đi qua bộ nén âm lượng tổng. Nếu trình duyệt không tải hoặc giải mã được `.ogg`, phần âm tổng hợp vẫn phát được. Tám mẫu âm trong `assets/sfx/` được chọn từ [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), giấy phép **CC0**; danh sách tệp và cách dùng ghi tại [`assets/sfx/README.md`](assets/sfx/README.md). Three.js theo MIT, giấy phép nằm trong `vendor/THREE-LICENSE.txt`. Font dùng bộ font sẵn có trên máy; game không phụ thuộc CDN hoặc Google Fonts khi chạy.

## Giới hạn hiện tại

- Chưa cài đầy đủ thủ tục xử lý trường chiếu/trường tróc theo luật giải đấu; dùng hòa khi lặp trạng thái ba lần như đã nêu.
- Chưa có đồng hồ thi đấu, lưu/tải ván, đấu qua mạng hoặc opening book/endgame tablebase.
- Bảng nhớ dùng chuỗi bàn cờ; có thể nâng cấp lên Zobrist hashing để giảm chi phí tạo khóa.
- Đây là AI tìm kiếm theo hàm lượng giá viết tay, không phải mô hình machine learning và không có bảo đảm chơi ngang các engine cờ tướng chuyên nghiệp.
- 3D hiện là phong cách procedural/stylized: chưa có nhân vật hoạt hình, mô hình/texture do họa sĩ làm riêng, nhạc nền dàn nhạc hoặc cinematic dài. Không nên hiểu phiên bản này đã đạt chất lượng sản xuất của TFT.
- FPS phụ thuộc GPU, độ phân giải và mức hiệu ứng. Máy yếu nên chọn Cân bằng/Tinh gọn hoặc chuyển 2D. Điều khiển bàn cờ hiện dùng chuột/chạm, chưa hỗ trợ đi quân hoàn toàn bằng bàn phím.

Mình giữ các giới hạn này trong README để người xem repo biết rõ phần nào đã hoàn thành và phần nào vẫn là hướng mở rộng, thay vì chỉ nhìn giao diện rồi hiểu nhầm dự án là một nền tảng thi đấu đầy đủ.

## Đưa lên GitHub

Đưa mã nguồn, test, tài liệu, `assets/`, `vendor/`, `scripts/`, `package.json` và `package-lock.json` lên repo. **Không đưa `node_modules/`, `.artifacts/`, báo cáo kiểm thử hoặc log lên GitHub**; `.gitignore` đã chặn các mục này. `vendor/` là ngoại lệ có chủ đích: chứa thư viện runtime được đóng gói để tải repo xong có thể chạy game ngay. Không xóa tám tệp `.ogg` hoặc giấy phép Three.js vì game đang sử dụng chúng. `Update.md` được giữ như nhật ký thay đổi.

Trước khi tạo commit, nên chạy lại:

```powershell
npm.cmd test
git status --short
```

Nếu muốn cho phép người khác tái sử dụng mã nguồn theo một giấy phép cụ thể, chủ repo cần tự chọn và thêm tệp `LICENSE`. CC0 của **mẫu âm Kenney** không tự động trở thành giấy phép cho toàn bộ mã nguồn.

## Tài liệu tham khảo

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) và [UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html): dựng cảnh WebGL2, bóng và ánh sáng hậu kỳ.
- [World Xiangqi Rules - World Xiangqi Federation](https://www.wxf-xiangqi.org/index.php?Itemid=291&id=269&lang=en&option=com_content&view=article): trang giới thiệu và đường dẫn tới bộ luật thi đấu.
- [Introduction to Xiangqi - World Xiangqi Federation](https://www.wxf-xiangqi.org/index.php?Itemid=304&id=208&lang=en&option=com_content&view=article): thuật ngữ và cách chơi.
- [Impact Sounds — Kenney](https://kenney.nl/assets/impact-sounds) và [trang hỗ trợ giấy phép của Kenney](https://kenney.nl/support): nguồn mẫu âm CC0.
- [Bringing the Festival to Life — Teamfight Tactics](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/bringing-the-festival-to-life/): tham khảo tư duy làm arena phản ứng với trận đấu, không sử dụng asset của Riot.
