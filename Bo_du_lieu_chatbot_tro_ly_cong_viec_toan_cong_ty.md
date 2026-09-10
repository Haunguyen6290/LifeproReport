# BỘ DỮ LIỆU CHATBOT – TRỢ LÝ CÔNG VIỆC TOÀN CÔNG TY

> **Mục đích:** Bộ dữ liệu cố định dùng làm kho kiến thức cho các chatbot theo từng phân hệ, không phụ thuộc gọi AI API.
>
> **Tư duy chung:** Mục tiêu → Kế hoạch → Thực hiện → Báo cáo tuần → Check-in hàng tuần → Vấn đề → Đề xuất → Theo đến kết quả → Cải tiến.
>
> **Nguyên tắc:** Chatbot chuyên môn riêng nhưng phải dùng chung cách tư duy và cách làm việc của công ty.

## 1. CẤU TRÚC DỮ LIỆU

Điểm dữ liệu chuẩn gồm:

- **ID**: mã câu hỏi.
- **Phân hệ**: chatbot/phân hệ sở hữu dữ liệu.
- **Nhóm chủ đề**: nhóm kiến thức.
- **Câu hỏi**: cách hỏi chuẩn.
- **Trả lời chuẩn**: câu trả lời công ty thống nhất.
- **Ví dụ**: tình huống minh họa.
- **Câu hỏi tiếp theo**: câu hỏi bot dùng để hỏi ngược khi cần.
- **Hành động**: việc người dùng nên làm sau khi nhận câu trả lời.
- **Phân hệ liên quan**: nơi cần chuyển hoặc liên kết tiếp.
- **Vai trò**: đối tượng sử dụng.
- **Mức độ**: độ khó.
- **Ưu tiên**: mức quan trọng.
- **Dữ liệu cần có**: dữ liệu bot cần để trả lời tốt.
- **Không tự đoán**: nguyên tắc giới hạn kết luận.

## 2. BỘ NGUYÊN TẮC CHUNG CỦA TẤT CẢ CHATBOT

| Nhóm quy tắc | Quy tắc | Ví dụ đúng | Ví dụ sai | Mục đích |
|---|---|---|---|---|
| Cách trả lời | 100% tiếng Việt, dễ hiểu, ưu tiên câu ngắn và ví dụ thực tế. | OKRs là mục tiêu và các kết quả then chốt. | Lạm dụng thuật ngữ tiếng Anh. | Phù hợp đội ngũ chưa quen phương pháp. |
| Hỏi ngược | Thiếu dữ liệu thì hỏi thêm, không tự kết luận. | Bạn có số doanh thu hiện tại không? | Khách chắc chắn không mua vì giá. | Tránh đoán sai. |
| Đề xuất | Báo cáo vấn đề nên có đề xuất xây dựng. | Đề xuất rà 20 khách trong 2 tuần. | Đề nghị xử lý. | Rèn tính chủ động. |
| Theo đến cùng | Đã báo không đồng nghĩa đã xong. | Ai xử lý? Hạn nào? Kiểm tra lại khi nào? | Em chuyển rồi. | Không bỏ vấn đề giữa đường. |
| Check-in hàng tuần | Chỉ đánh giá sức khỏe OKRs, không kể chi tiết. | Ổn – tốc độ chậm hơn kế hoạch. | Kể lại 10 việc đã làm. | Phân biệt với Báo cáo tuần. |
| Không bịa | Không tạo số liệu ngoài hệ thống. | Chưa có dữ liệu để kết luận. | Tự cho số liệu. | Tin cậy. |
| Đúng phân hệ | Đưa người dùng về đúng nơi xử lý. | Vấn đề đơn hàng → Tổng hợp kho/Báo cáo vấn đề. | Đăng tất cả lên Bảng tin. | Không chồng chéo. |
| Thẩm quyền | Bot gợi ý, không tự thay người có quyền quyết định. | Đề xuất thay nhà cung cấp; cần quản lý xác nhận. | Đổi ngay nhà cung cấp. | Đúng vai trò. |

## 3. BỘ QA THEO TỪNG TRỢ LÝ

**Tổng số bản ghi QA hiện tại: 91**

## Bộ não chung công ty

### Nguyên tắc chung

#### QA-0001 — Phần mềm này dùng để làm gì?

**Trả lời chuẩn:** Phần mềm giúp công ty nhìn mục tiêu, lập kế hoạch, theo dõi kết quả, phát hiện vấn đề, đề xuất xử lý và cải tiến.

**Ví dụ:** Mục tiêu → Kế hoạch → Thực hiện → Báo cáo tuần → Check-in hàng tuần → Vấn đề → Đề xuất → Theo đến kết quả → Cải tiến.

**Câu hỏi tiếp theo:** Bạn đang cần hỗ trợ ở bước nào?

**Hành động:** Hướng người dùng tới đúng phân hệ.

**Phân hệ liên quan:** OKRs, Kế hoạch, Báo cáo tuần, Check-in hàng tuần, Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0002 — Đã báo vấn đề thì có được coi là xong không?

**Trả lời chuẩn:** Không. Báo cáo là điểm bắt đầu của quá trình xử lý. Nếu vấn đề vẫn còn, cần theo dõi, nhắc lại, bổ sung thông tin, đề xuất hoặc tìm người có thẩm quyền.

**Ví dụ:** Đã báo hàng tồn lâu nhưng hàng vẫn không giảm thì chưa thể coi là xong.

**Câu hỏi tiếp theo:** Vấn đề hiện đã được xử lý chưa?

**Hành động:** Yêu cầu cập nhật trạng thái và việc tiếp theo.

**Phân hệ liên quan:** Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0003 — Đề xuất xử lý để làm gì?

**Trả lời chuẩn:** Để thể hiện người báo đã suy nghĩ về cách giải quyết, giúp lãnh đạo có cơ sở quyết định và tránh báo xong rồi để đó.

**Ví dụ:** Đề xuất: rà 20 khách đang bán sản phẩm tương tự để thử bán mã A trong 2 tuần.

**Câu hỏi tiếp theo:** Bạn đang đề xuất phương án nào?

**Hành động:** Yêu cầu bổ sung đề xuất cụ thể.

**Phân hệ liên quan:** Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0004 — Thế nào là đề xuất có tính xây dựng?

**Trả lời chuẩn:** Đề xuất phải cụ thể, có căn cứ, có lý do, có cách thực hiện và kết quả mong muốn; không viết cho đủ trường thông tin.

**Ví dụ:** Không nên viết “Đề nghị xử lý”; nên viết rõ việc, người, thời hạn và kết quả.

**Câu hỏi tiếp theo:** Bạn có thể nêu 1–3 phương án không?

**Hành động:** Gợi ý cấu trúc đề xuất.

**Phân hệ liên quan:** Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Bắt bệnh

#### QA-0005 — Vì sao nhân sự cần học cách động não?

**Trả lời chuẩn:** Vì cách làm cũ thường là nhận việc → làm → xong. Cách làm mới đòi hỏi suy nghĩ mục tiêu, kết quả, nguyên nhân và phương án.

**Ví dụ:** Kho không chỉ xuất hàng mà phải nghĩ xem tồn lâu, hàng xuống cấp và rủi ro đang ở đâu.

**Câu hỏi tiếp theo:** Bạn đang bí ở bước suy nghĩ nào?

**Hành động:** Dẫn về 7 câu hỏi cốt lõi.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0006 — Vì sao nhân sự phải học cách diễn giải?

**Trả lời chuẩn:** Người quản lý không nhìn thấy suy nghĩ trong đầu nhân viên. Thông tin phải được diễn giải đủ rõ để phối hợp và ra quyết định.

**Ví dụ:** “Hàng tồn nhiều” chưa đủ; cần số lượng, thời gian tồn, ảnh hưởng và đề xuất.

**Câu hỏi tiếp theo:** Bạn có thể mô tả hiện trạng bằng số liệu không?

**Hành động:** Yêu cầu bổ sung thông tin.

**Phân hệ liên quan:** OKRs, Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0007 — Tại sao phải làm việc bằng kết quả?

**Trả lời chuẩn:** Hoàn thành nhiều đầu việc chưa đồng nghĩa với hiệu quả. Công ty cần biết công việc đã làm thay đổi doanh thu, tồn kho, thời gian, chất lượng, khách hàng hoặc rủi ro như thế nào.

**Ví dụ:** Gọi 30 khách nhưng không có khách mua vẫn chưa phải kết quả bán hàng tốt.

**Câu hỏi tiếp theo:** Kết quả cuối cùng của việc này là gì?

**Hành động:** Chuyển từ hoạt động sang kết quả.

**Phân hệ liên quan:** OKRs, Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Phân hệ

#### QA-0008 — Tại sao đã có OKRs rồi còn Kế hoạch?

**Trả lời chuẩn:** OKRs là đích đến; Kế hoạch là những việc sẽ làm để đi đến đích.

**Ví dụ:** OKR: giảm tồn lâu từ 2 tỷ xuống 1 tỷ. Kế hoạch: thống kê, phân loại, phối hợp kinh doanh.

**Câu hỏi tiếp theo:** Bạn đang lập kế hoạch cho KR nào?

**Hành động:** Gắn kế hoạch với KR.

**Phân hệ liên quan:** OKRs, Kế hoạch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0009 — Tại sao có Kế hoạch rồi còn Báo cáo tuần?

**Trả lời chuẩn:** Kế hoạch là dự kiến; Báo cáo tuần là thực tế đã làm và kết quả đã đạt.

**Ví dụ:** Kế hoạch: tiếp cận 30 khách. Báo cáo: thực tế 25 khách, 7 quan tâm, 2 mua.

**Câu hỏi tiếp theo:** Bạn đã có số thực tế chưa?

**Hành động:** Chuyển sang báo cáo.

**Phân hệ liên quan:** Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0010 — Tại sao có Báo cáo tuần rồi còn Check-in hàng tuần?

**Trả lời chuẩn:** Báo cáo tuần đi vào chi tiết; Check-in hàng tuần nhìn tổng thể xem OKRs còn khả năng đạt hay không.

**Ví dụ:** Báo cáo: đã gặp 8 khách. Check-in: tốc độ doanh thu đang chậm nên mục tiêu có nguy cơ.

**Câu hỏi tiếp theo:** Bạn đang cần chi tiết hay đánh giá khả năng đạt?

**Hành động:** Đi tới đúng chức năng.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0011 — Báo cáo thị trường khác Chiến dịch thế nào?

**Trả lời chuẩn:** Thông tin thị trường ghi nhận điều đang xảy ra bên ngoài; Chiến dịch là chương trình công ty chủ động triển khai để đạt một mục tiêu cụ thể.

**Ví dụ:** Đối thủ giảm giá 10% là thông tin thị trường; thử bán sản phẩm A cho 50 gara là chiến dịch.

**Câu hỏi tiếp theo:** Thông tin này có dẫn tới một chương trình hành động không?

**Hành động:** Liên kết sang chiến dịch nếu có.

**Phân hệ liên quan:** Trợ lý Thị trường kinh doanh, Trợ lý Chiến dịch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Đào tạo

#### QA-0090 — 5 câu hỏi cốt lõi để tự xây OKRs là gì?

**Trả lời chuẩn:** 1) Tôi muốn đạt điều gì? 2) Làm sao biết đã đạt? 3) Hiện tại ở đâu? 4) Muốn đạt phải làm gì? 5) Điều gì có thể khiến không đạt? 6) Nếu không đạt tôi biết từ khi nào? 7) Nếu phát hiện không đạt tôi làm gì?

**Ví dụ:** Các câu hỏi dẫn từ vấn đề thực tế tới Mục tiêu, Kết quả, Số liệu, Kế hoạch, Check-in và Đề xuất xử lý.

**Câu hỏi tiếp theo:** Bạn muốn áp dụng cho bộ phận nào?

**Hành động:** Dùng bộ câu hỏi theo vị trí.

**Phân hệ liên quan:** OKRs, Kế hoạch, Check-in hàng tuần, Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0091 — Vì sao 7 câu hỏi lại giúp hiểu OKRs dễ hơn?

**Trả lời chuẩn:** Vì nhân viên tự suy nghĩ từ công việc thật thay vì học định nghĩa trước. Khi tự tìm mục tiêu, cách đo và cách làm, họ sẽ thấy đó chính là OKRs.

**Ví dụ:** Kho: vấn đề tồn lâu → ảnh hưởng → giảm tồn → đo giá trị tồn >6 tháng → thống kê/phân loại/phối hợp/xử lý.

**Câu hỏi tiếp theo:** Bạn muốn làm thử một ví dụ?

**Hành động:** Dẫn bài tập theo vị trí.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý OKRs

### Khái niệm

#### QA-0012 — OKRs là gì?

**Trả lời chuẩn:** OKRs là cách xác định mục tiêu và các kết quả then chốt để biết mục tiêu đang được thực hiện và đạt đến đâu. O là Mục tiêu; KR là Kết quả then chốt.

**Ví dụ:** O: Giảm hàng tồn lâu. KR: Giảm hàng tồn trên 6 tháng từ 2 tỷ xuống 1 tỷ.

**Câu hỏi tiếp theo:** Bạn muốn xây OKRs cho vị trí nào?

**Hành động:** Gợi ý theo vị trí.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Xây O

#### QA-0013 — O là gì?

**Trả lời chuẩn:** O là Mục tiêu: điều quan trọng muốn đạt trong một giai đoạn.

**Ví dụ:** O: Kiểm soát hàng tồn kho hiệu quả hơn.

**Câu hỏi tiếp theo:** Mục tiêu bạn đang viết là gì?

**Hành động:** Kiểm tra O.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0015 — O có nên là công việc không?

**Trả lời chuẩn:** Không nên. O là kết quả mong muốn, không phải danh sách việc phải làm.

**Ví dụ:** “Gọi 30 khách” là hoạt động; “Phát triển khách hàng mới” là mục tiêu.

**Câu hỏi tiếp theo:** Mục tiêu này có phải kết quả mong muốn chưa?

**Hành động:** Chuyển hoạt động sang mục tiêu.

**Phân hệ liên quan:** Kế hoạch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Xây KR

#### QA-0014 — KR là gì?

**Trả lời chuẩn:** KR là Kết quả then chốt dùng để chứng minh mục tiêu đang đạt đến đâu.

**Ví dụ:** KR: Giảm tồn trên 6 tháng từ 2 tỷ xuống 1 tỷ.

**Câu hỏi tiếp theo:** Bạn đo kết quả bằng chỉ số nào?

**Hành động:** Kiểm tra KR.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0016 — KR có cần số không?

**Trả lời chuẩn:** Ưu tiên có số hoặc tiêu chí rõ để kiểm chứng.

**Ví dụ:** 100% hàng tồn lâu được thống kê; giảm tồn trên 6 tháng xuống 1 tỷ.

**Câu hỏi tiếp theo:** KR này kiểm chứng bằng gì?

**Hành động:** Gợi ý cách đo.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Kiểm tra

#### QA-0017 — KR “Theo dõi khách hàng” có tốt không?

**Trả lời chuẩn:** Chưa tốt vì đây là hoạt động. Nên chuyển thành kết quả như số khách mua lại, doanh thu khách cũ hoặc số khách được kích hoạt.

**Ví dụ:** 5 khách cũ tăng doanh số rõ hơn “theo dõi khách hàng”.

**Câu hỏi tiếp theo:** Bạn muốn đo kết quả nào?

**Hành động:** Đề xuất KR.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Check-in

#### QA-0018 — Check-in hàng tuần là gì?

**Trả lời chuẩn:** Là lần rà soát ngắn để đánh giá O/KR đang đi đúng hướng hay không, khả năng đạt mục tiêu thế nào và có cần thay đổi hành động không.

**Ví dụ:** Tốt = đúng hướng; Ổn = có nguy cơ nhưng còn cứu được; Tệ = lệch mạnh.

**Câu hỏi tiếp theo:** O/KR nào bạn muốn check-in?

**Hành động:** Mở check-in.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Thay đổi

#### QA-0019 — Có được thay đổi KR giữa chu kỳ không?

**Trả lời chuẩn:** Có thể khi dữ liệu chứng minh KR không còn phù hợp hoặc cách đo không hữu ích. Phải nêu lý do và không đổi chỉ để làm đẹp kết quả.

**Ví dụ:** KR đặt sai cách đo ngay từ đầu có thể sửa để phản ánh đúng mục tiêu.

**Câu hỏi tiếp theo:** Vì sao cần thay đổi?

**Hành động:** Ghi lý do.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Liên kết

#### QA-0020 — OKRs cá nhân liên quan mục tiêu công ty thế nào?

**Trả lời chuẩn:** Mỗi người cần hiểu công việc của mình đóng góp vào mục tiêu nào của công ty.

**Ví dụ:** Doanh thu 45 tỷ → Kinh doanh tạo doanh thu; Mua hàng đảm bảo hàng; Kho đảm bảo xuất hàng.

**Câu hỏi tiếp theo:** Bạn đang đóng góp vào O nào?

**Hành động:** Kiểm tra liên kết.

**Phân hệ liên quan:** OKRs, Kế hoạch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Kế hoạch

### Lập kế hoạch

#### QA-0021 — Kế hoạch tốt cần có gì?

**Trả lời chuẩn:** Việc cụ thể, người phụ trách, thời hạn, kết quả mong muốn và sự phụ thuộc nếu có.

**Ví dụ:** Liên hệ 20 khách, phụ trách A, trước thứ Sáu, mục tiêu 5 khách phản hồi.

**Câu hỏi tiếp theo:** Việc này ai làm và bao giờ xong?

**Hành động:** Bổ sung người và hạn.

**Phân hệ liên quan:** Kế hoạch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0022 — Có nên đưa tất cả việc trong ngày vào kế hoạch không?

**Trả lời chuẩn:** Không. Tập trung việc quan trọng có tác động tới mục tiêu.

**Ví dụ:** Kế hoạch tuần ưu tiên việc kéo KR, không phải nhật ký mọi thao tác.

**Câu hỏi tiếp theo:** Việc này tác động KR nào?

**Hành động:** Gắn với KR.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Không hoàn thành

#### QA-0023 — Nếu kế hoạch không hoàn thành thì làm gì?

**Trả lời chuẩn:** Nêu nguyên nhân, ảnh hưởng, việc tiếp theo và thời hạn mới. Không chỉ ghi “chưa xong”.

**Ví dụ:** Chưa hoàn thành vì thiếu dữ liệu từ Mua hàng; dự kiến nhận trước ngày X.

**Câu hỏi tiếp theo:** Nguyên nhân và việc tiếp theo?

**Hành động:** Cập nhật lại.

**Phân hệ liên quan:** Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Phát sinh

#### QA-0024 — Việc phát sinh ngoài kế hoạch thì sao?

**Trả lời chuẩn:** Đánh giá mức độ quan trọng và ảnh hưởng đến mục tiêu. Nếu quan trọng, bổ sung kế hoạch; nếu làm lệch mục tiêu, phải nêu rõ.

**Ví dụ:** Đơn gấp có thể thêm nhưng phải biết việc nào bị ảnh hưởng.

**Câu hỏi tiếp theo:** Việc phát sinh có làm trễ mục tiêu không?

**Hành động:** Điều chỉnh kế hoạch.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Báo cáo tuần

### Khái niệm

#### QA-0025 — Báo cáo tuần để làm gì?

**Trả lời chuẩn:** Để phản ánh công việc đã thực hiện, kết quả đạt được, phần chưa đạt và vấn đề phát sinh trong tuần.

**Ví dụ:** Đã tiếp cận 30 khách; 8 quan tâm; 3 mua thử; doanh thu 80 triệu.

**Câu hỏi tiếp theo:** Bạn muốn báo cáo kết quả nào?

**Hành động:** Gợi ý cấu trúc.

**Phân hệ liên quan:** Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Viết báo cáo

#### QA-0026 — Báo cáo tuần có cần số liệu không?

**Trả lời chuẩn:** Có, đặc biệt với kết quả quan trọng. Nếu chưa có số tuyệt đối thì phải có bằng chứng hoặc tiêu chí rõ.

**Ví dụ:** Không chỉ “đã chăm sóc khách”; cần số khách, kết quả, doanh thu hoặc phản hồi.

**Câu hỏi tiếp theo:** Bạn có số liệu chứng minh chưa?

**Hành động:** Bổ sung.

**Phân hệ liên quan:** Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Phân biệt

#### QA-0027 — Báo cáo tuần khác Check-in hàng tuần thế nào?

**Trả lời chuẩn:** Báo cáo tuần đi vào chi tiết; Check-in hàng tuần nhìn sức khỏe của OKRs.

**Ví dụ:** Báo cáo: đã gọi 30 khách. Check-in: khả năng đạt doanh thu có còn tốt không?

**Câu hỏi tiếp theo:** Bạn cần chi tiết hay đánh giá khả năng đạt?

**Hành động:** Chọn đúng chức năng.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Check-in hàng tuần

### Đánh giá

#### QA-0028 — Khi nào chọn Tốt?

**Trả lời chuẩn:** Khi kết quả và tốc độ hiện tại cho thấy mục tiêu có khả năng đạt nếu tiếp tục đúng hướng.

**Ví dụ:** Doanh thu đang đúng nhịp và đơn hàng tăng ổn định.

**Câu hỏi tiếp theo:** Có nguy cơ mới không?

**Hành động:** Tiếp tục theo dõi.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0029 — Khi nào chọn Ổn?

**Trả lời chuẩn:** Khi mục tiêu vẫn còn khả năng đạt nhưng tốc độ hoặc một yếu tố cản trở cần điều chỉnh.

**Ví dụ:** Doanh thu đạt nhưng tốc độ thấp hơn kế hoạch 10%.

**Câu hỏi tiếp theo:** Điều gì cần thay đổi?

**Hành động:** Đề xuất điều chỉnh.

**Phân hệ liên quan:** Check-in hàng tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0030 — Khi nào chọn Tệ?

**Trả lời chuẩn:** Khi kết quả lệch đáng kể và nếu giữ cách làm hiện tại thì khả năng đạt mục tiêu thấp.

**Ví dụ:** Mục tiêu 2 tỷ nhưng đã đi gần hết chu kỳ mới đạt 600 triệu.

**Câu hỏi tiếp theo:** Nguyên nhân và phương án?

**Hành động:** Mở Báo cáo vấn đề nếu cần.

**Phân hệ liên quan:** Check-in hàng tuần, Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Tần suất

#### QA-0031 — Check-in thực hiện khi nào?

**Trả lời chuẩn:** Hàng tuần theo lịch chung của công ty, tập trung vào khả năng đạt mục tiêu.

**Ví dụ:** Mỗi cuối tuần nhân viên cập nhật trạng thái O/KR.

**Câu hỏi tiếp theo:** Tuần này khả năng đạt mục tiêu thế nào?

**Hành động:** Thực hiện check-in hàng tuần.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Báo cáo vấn đề

### Phát hiện

#### QA-0032 — Khi nào nên tạo Báo cáo vấn đề?

**Trả lời chuẩn:** Khi có điều đang cản trở mục tiêu, có nguy cơ gây ảnh hưởng hoặc một lỗi cần người khác phối hợp xử lý.

**Ví dụ:** Hàng tồn lâu tăng liên tục, nhà cung cấp chậm bảo hành, công nợ tăng bất thường.

**Câu hỏi tiếp theo:** Vấn đề ảnh hưởng mục tiêu nào?

**Hành động:** Tạo báo cáo vấn đề.

**Phân hệ liên quan:** OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Trách nhiệm

#### QA-0033 — “Không phải việc của tôi” thì sao?

**Trả lời chuẩn:** Không cần làm thay người khác nhưng không nên bỏ mặc. Đưa vấn đề đến đúng người và theo dõi.

**Ví dụ:** Kho thấy hàng tồn lâu → báo người phụ trách và theo dõi.

**Câu hỏi tiếp theo:** Ai là người có trách nhiệm trực tiếp?

**Hành động:** Gán người xử lý.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0034 — “Tôi đã báo rồi” có đủ chưa?

**Trả lời chuẩn:** Chưa. Nếu vấn đề còn tồn tại, cần kiểm tra trạng thái, nhắc lại, bổ sung thông tin hoặc đề xuất phương án.

**Ví dụ:** Đã báo hàng bảo hành chậm nhưng chưa có phản hồi.

**Câu hỏi tiếp theo:** Vấn đề hiện đã được xử lý chưa?

**Hành động:** Cập nhật theo dõi.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0035 — “Tôi đã nói nhiều lần mà không ai giải quyết” thì làm gì?

**Trả lời chuẩn:** Không dừng lại. Làm rõ ảnh hưởng, đề xuất phương án, xác định người có quyền xử lý và đưa lên cấp cao hơn khi cần.

**Ví dụ:** Vấn đề ảnh hưởng doanh thu và kéo dài → đưa lên quản lý/CEO kèm dữ liệu.

**Câu hỏi tiếp theo:** Ai có quyền quyết định?

**Hành động:** Chuyển cấp xử lý khi cần.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Đề xuất

#### QA-0036 — Báo cáo vấn đề cần những gì?

**Trả lời chuẩn:** Vấn đề, số liệu/thực tế, ảnh hưởng, nguyên nhân dự kiến, việc đã thử, đề xuất, người cần hỗ trợ, thời hạn và cách kiểm tra kết quả.

**Ví dụ:** Hàng tồn 500 sản phẩm, 300 trên 6 tháng; đề xuất rà 20 khách và thử 2 tuần.

**Câu hỏi tiếp theo:** Đề xuất của bạn là gì?

**Hành động:** Hoàn thiện báo cáo.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0037 — Đề xuất “đề nghị công ty xử lý” có đạt không?

**Trả lời chuẩn:** Chưa. Đó là yêu cầu chung chung. Cần nêu phương án cụ thể và lý do.

**Ví dụ:** Đề xuất rà khách, thử gói bán và dừng nhập thêm trong thời gian kiểm tra.

**Câu hỏi tiếp theo:** Bạn có thể nêu phương án cụ thể không?

**Hành động:** Yêu cầu bổ sung.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Theo đến cùng

#### QA-0038 — Lãnh đạo chưa giải quyết ngay thì sao?

**Trả lời chuẩn:** Vấn đề chưa xong. Tiếp tục theo dõi, nhắc, bổ sung dữ liệu, đề xuất lại hoặc tìm người có thẩm quyền hơn khi phù hợp.

**Ví dụ:** Đã báo dòng tiền nhưng chưa có quyết định → cập nhật mức ảnh hưởng mới.

**Câu hỏi tiếp theo:** Lần theo dõi tiếp theo là khi nào?

**Hành động:** Đặt lịch theo dõi.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Khách hàng

### Mục đích

#### QA-0039 — Trợ lý Khách hàng dùng để làm gì?

**Trả lời chuẩn:** Giúp nhân viên thu thập thông tin khách, hiểu cách khách vận hành, khai thác cơ hội bán hàng, phân hạng khách và xác định hành động tiếp theo.

**Ví dụ:** Khách đang bán camera của đối thủ nhưng chưa bán sản phẩm A → xác định cơ hội thử A.

**Câu hỏi tiếp theo:** Bạn đang tạo mới hay khai thác khách đã có?

**Hành động:** Đi theo luồng phù hợp.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Thông tin vận hành

#### QA-0040 — Thông tin vận hành của khách gồm gì?

**Trả lời chuẩn:** Cách khách kinh doanh, sản phẩm đang bán, nhà cung cấp, giá, sản lượng, tần suất nhập, cách bán và vấn đề họ gặp.

**Ví dụ:** Gara bán camera, lấy hàng từ 3 nguồn, bán khoảng 50 bộ/tháng.

**Câu hỏi tiếp theo:** Bạn biết khách đang bán gì và mua từ ai chưa?

**Hành động:** Gợi ý câu hỏi tiếp theo.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Khai thác

#### QA-0041 — Khách đang bán gì?

**Trả lời chuẩn:** Ghi nhóm sản phẩm, thương hiệu, mã, sản phẩm bán tốt/chậm và nhóm khách họ phục vụ.

**Ví dụ:** Camera, màn hình, cảm biến; camera A bán tốt.

**Câu hỏi tiếp theo:** Bạn có giá và sản lượng không?

**Hành động:** Bổ sung dữ liệu.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0042 — Khách đang mua từ ai?

**Trả lời chuẩn:** Ghi nhà cung cấp/đối thủ, sản phẩm, giá và điều kiện mua nếu biết để tìm khoảng trống bán.

**Ví dụ:** Khách mua camera X từ nhà cung cấp B với giá 900 nghìn.

**Câu hỏi tiếp theo:** Giá và sản lượng đã xác nhận chưa?

**Hành động:** Bổ sung nếu có.

**Phân hệ liên quan:** Thị trường kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0043 — Làm sao tìm cơ hội bán thêm?

**Trả lời chuẩn:** Nhìn 3 thứ: khách đang bán gì, khách mua gì từ người khác và khách chưa bán gì nhưng có khả năng bán.

**Ví dụ:** Khách bán camera nhưng chưa bán cảm biến áp suất lốp.

**Câu hỏi tiếp theo:** Khách đang thiếu nhóm sản phẩm nào?

**Hành động:** Đề xuất sản phẩm thử.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Phân hạng

#### QA-0044 — Phân hạng khách để làm gì?

**Trả lời chuẩn:** Để ưu tiên thời gian và cách chăm sóc. Phải dựa trên dữ liệu, không chỉ cảm giác.

**Ví dụ:** Khách tiềm năng: quy mô tốt, mua ít nhưng còn dư địa lớn.

**Câu hỏi tiếp theo:** Dữ liệu đã đủ chưa?

**Hành động:** Kiểm tra hồ sơ.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

#### QA-0045 — Bot có tự quyết định hạng khách không?

**Trả lời chuẩn:** Bot nên phân tích và đề xuất; nhân viên hoặc quản lý xác nhận khi dữ liệu đủ.

**Ví dụ:** Đề xuất Khách hàng tiềm năng vì quy mô tốt nhưng tỷ trọng mua thấp.

**Câu hỏi tiếp theo:** Bạn có đồng ý hạng này không?

**Hành động:** Yêu cầu xác nhận.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Tình huống

#### QA-0046 — Khách nói không quan tâm sản phẩm thì hỏi gì?

**Trả lời chuẩn:** Hỏi lý do: giá, đang dùng thương hiệu khác, chưa có nhu cầu, chưa tin, chưa hiểu, chưa có khách hỏi hoặc chưa rõ.

**Ví dụ:** Khách không quan tâm vì giá cao hơn 10%.

**Câu hỏi tiếp theo:** Bạn đã thử phương án nào?

**Hành động:** Gợi ý bước tiếp theo.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Thiếu dữ liệu

#### QA-0047 — Hồ sơ khách chưa đủ thì sao?

**Trả lời chuẩn:** Không cố kết luận khi thiếu dữ liệu quan trọng. Chỉ ra thông tin thiếu và dẫn nhân viên bổ sung.

**Ví dụ:** Thiếu nhà cung cấp và sản lượng/tháng → chưa đủ để đánh giá cơ hội.

**Câu hỏi tiếp theo:** Thông tin nào còn thiếu?

**Hành động:** Bổ sung hồ sơ.

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Hành động

#### QA-0048 — Sau khi cập nhật khách cần làm gì tiếp?

**Trả lời chuẩn:** Xác định một hành động cụ thể: giới thiệu, báo giá, nhập thử, gặp trực tiếp, hỏi thêm thông tin hoặc đưa vào chiến dịch.

**Ví dụ:** Khách có nhu cầu camera → đề nghị nhập thử 20 bộ.

**Câu hỏi tiếp theo:** Bước tiếp theo và hạn nào?

**Hành động:** Tạo kế hoạch.

**Phân hệ liên quan:** Kế hoạch, Chiến dịch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Kinh doanh

### Mục tiêu

#### QA-0049 — Kinh doanh hiệu quả là gì?

**Trả lời chuẩn:** Không chỉ gọi nhiều khách; phải tạo doanh thu, khách mới, khách mua lại, khách tăng doanh số và phát hiện khách giảm mua.

**Ví dụ:** 30 cuộc gọi nhưng 0 đơn chưa phải kết quả bán hàng tốt.

**Câu hỏi tiếp theo:** KR đang đo doanh thu hay chỉ hoạt động?

**Hành động:** Chuyển sang kết quả.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Khách mới

#### QA-0050 — Muốn phát triển khách mới làm gì?

**Trả lời chuẩn:** Rà đúng khách → tiếp cận → tìm nhu cầu → giới thiệu → báo giá → theo dõi → thử → mua lần đầu → mua lại.

**Ví dụ:** 30 tiếp cận → 10 trao đổi → 5 thử → 3 mua.

**Câu hỏi tiếp theo:** Thiếu ở bước nào?

**Hành động:** Lập kế hoạch.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Khách cũ

#### QA-0051 — Làm sao tăng doanh số khách cũ?

**Trả lời chuẩn:** Xem khách giảm, khách có dư địa và sản phẩm chưa mua; chọn khách ưu tiên và hành động cụ thể.

**Ví dụ:** Khách mua camera nhưng chưa mua cảm biến.

**Câu hỏi tiếp theo:** Khách nào có cơ hội tăng?

**Hành động:** Tạo kế hoạch.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Mất khách

#### QA-0052 — Khách giảm mua cần làm gì?

**Trả lời chuẩn:** Xác định nguyên nhân trước: giá, chất lượng, thiếu hàng, công nợ, đối thủ, quan hệ hoặc nhu cầu thay đổi.

**Ví dụ:** Doanh số khách giảm 35% và chuyển một phần sang đối thủ.

**Câu hỏi tiếp theo:** Nguyên nhân đã rõ chưa?

**Hành động:** Tạo báo cáo vấn đề nếu cần.

**Phân hệ liên quan:** Kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Kho

### Hiệu quả

#### QA-0053 — Kho hiệu quả là gì?

**Trả lời chuẩn:** Không chỉ xuất hết đơn; còn phải xuất đúng, nhanh, chính xác, kiểm soát tồn kho, phát hiện hàng thiếu phẩm chất và cảnh báo rủi ro.

**Ví dụ:** Tồn trên 6 tháng 2 tỷ → phải theo dõi và đề xuất.

**Câu hỏi tiếp theo:** Hàng tồn lâu hiện bao nhiêu?

**Hành động:** Kiểm tra báo cáo kho.

**Phân hệ liên quan:** Kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Tồn kho

#### QA-0054 — Hàng tồn lâu cần làm gì?

**Trả lời chuẩn:** Thống kê → phân loại → nguyên nhân → báo bộ phận liên quan → đề xuất → theo dõi.

**Ví dụ:** 300 sản phẩm trên 6 tháng.

**Câu hỏi tiếp theo:** Phương án xử lý là gì?

**Hành động:** Tạo báo cáo vấn đề.

**Phân hệ liên quan:** Kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Chất lượng

#### QA-0055 — Hàng thiếu phẩm chất có phải báo một lần?

**Trả lời chuẩn:** Không. Cần ghi nhận, cảnh báo, xác định người xử lý và theo dõi đến khi có kết quả.

**Ví dụ:** 50 sản phẩm bao bì kém.

**Câu hỏi tiếp theo:** Ai quyết định?

**Hành động:** Theo dõi.

**Phân hệ liên quan:** Kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Sai lệch

#### QA-0056 — Chênh lệch tồn kho xử lý thế nào?

**Trả lời chuẩn:** Kiểm tra chứng từ, kiểm kê, tìm nguyên nhân và đề xuất ngăn lặp lại.

**Ví dụ:** Mã A lệch 20 chiếc.

**Câu hỏi tiếp theo:** Nguyên nhân đã rõ chưa?

**Hành động:** Báo vấn đề nếu lặp lại.

**Phân hệ liên quan:** Kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Tổng hợp kho

### Hiệu quả

#### QA-0057 — Tổng hợp kho hiệu quả là gì?

**Trả lời chuẩn:** Không chỉ in và ký phiếu; phải giúp dòng đơn hàng chạy nhanh, đúng, ít lỗi và nhìn thấy điểm nghẽn.

**Ví dụ:** 20 đơn phải sửa trong tuần → tìm nguyên nhân.

**Câu hỏi tiếp theo:** Đơn sai tập trung ở đâu?

**Hành động:** Báo vấn đề/cải tiến.

**Phân hệ liên quan:** Tổng hợp kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Đơn sai

#### QA-0058 — Đơn thường xuyên sai xử lý thế nào?

**Trả lời chuẩn:** Thống kê lỗi, xác định nguyên nhân, trao đổi bộ phận liên quan và thay đổi cách làm.

**Ví dụ:** Sai mã 12 lần.

**Câu hỏi tiếp theo:** Nguyên nhân là gì?

**Hành động:** Tạo báo cáo vấn đề.

**Phân hệ liên quan:** Tổng hợp kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Đơn chậm

#### QA-0059 — Đơn chậm nên báo gì?

**Trả lời chuẩn:** Thời gian chờ, công đoạn tắc, người/bộ phận liên quan và đề xuất tháo điểm nghẽn.

**Ví dụ:** Đơn vào 9h nhưng kho nhận 14h.

**Câu hỏi tiếp theo:** Điểm nghẽn nằm đâu?

**Hành động:** Báo cáo vấn đề.

**Phân hệ liên quan:** Tổng hợp kho

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Bảo hành

### Hiệu quả

#### QA-0060 — Bảo hành hiệu quả là gì?

**Trả lời chuẩn:** Xử lý nhanh, tồn bảo hành thấp, phát hiện lỗi theo sản phẩm/lô, cảnh báo nhà cung cấp và cung cấp dữ liệu cho quyết định mua.

**Ví dụ:** Tồn bảo hành tăng từ 20 lên 60.

**Câu hỏi tiếp theo:** Tồn đang tăng hay giảm?

**Hành động:** Cảnh báo.

**Phân hệ liên quan:** Bảo hành

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Lỗi theo lô

#### QA-0061 — Làm sao phát hiện lỗi theo lô?

**Trả lời chuẩn:** Gắn lỗi với sản phẩm, lô, thời điểm và nhà cung cấp; nếu tỷ lệ bất thường thì cảnh báo.

**Ví dụ:** 10/12 lỗi cùng lô A.

**Câu hỏi tiếp theo:** Cùng lô còn bao nhiêu hàng?

**Hành động:** Báo vấn đề.

**Phân hệ liên quan:** Bảo hành

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Nhà cung cấp

#### QA-0062 — Nhà cung cấp xử lý bảo hành chậm thì sao?

**Trả lời chuẩn:** Theo dõi cam kết, nhắc, ghi nhận chậm và tổng hợp để đánh giá.

**Ví dụ:** Hẹn 7 ngày nhưng 20 ngày chưa trả.

**Câu hỏi tiếp theo:** Đã quá hạn bao nhiêu?

**Hành động:** Theo dõi và báo cấp.

**Phân hệ liên quan:** Bảo hành

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Kế toán

### Hiệu quả

#### QA-0063 — Kế toán hiệu quả là gì?

**Trả lời chuẩn:** Không chỉ ghi nhận chính xác mà còn giúp nhìn thấy công nợ, dòng tiền, chi phí và rủi ro sớm.

**Ví dụ:** Công nợ tăng liên tục nhưng phải cảnh báo trước nguy cơ.

**Câu hỏi tiếp theo:** Rủi ro nào đang tăng?

**Hành động:** Tạo cảnh báo.

**Phân hệ liên quan:** Kế toán

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Công nợ

#### QA-0064 — Công nợ nên theo dõi gì?

**Trả lời chuẩn:** Số dư, tuổi nợ, xu hướng, lịch sử trả chậm và khoản có nguy cơ khó thu.

**Ví dụ:** Khách A nợ 180 triệu, tăng từ 50 triệu.

**Câu hỏi tiếp theo:** Khoản này có rủi ro không?

**Hành động:** Báo cáo rủi ro.

**Phân hệ liên quan:** Kế toán

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Dòng tiền

#### QA-0065 — Dòng tiền cần theo dõi thế nào?

**Trả lời chuẩn:** So sánh tiền vào/ra dự kiến với thực tế, khoản đến hạn và cảnh báo thiếu tiền trước khi xảy ra.

**Ví dụ:** Tuần sau phải trả 800 triệu nhưng dự kiến thu 500 triệu.

**Câu hỏi tiếp theo:** Khoảng thiếu bao nhiêu?

**Hành động:** Báo cáo vấn đề.

**Phân hệ liên quan:** Kế toán

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Chi phí

#### QA-0066 — Chi phí bất thường là gì?

**Trả lời chuẩn:** Khoản chi tăng đáng kể so với kế hoạch hoặc xu hướng bình thường và cần giải thích nguyên nhân.

**Ví dụ:** Chi phí vận chuyển tăng 30%.

**Câu hỏi tiếp theo:** Tăng do đâu?

**Hành động:** Tạo cảnh báo.

**Phân hệ liên quan:** Kế toán

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Mua hàng

### Hiệu quả

#### QA-0067 — Mua hàng hiệu quả là gì?

**Trả lời chuẩn:** Đủ hàng, đúng thời điểm, chất lượng ổn định, giá/điều kiện phù hợp và lượng nhập không tạo tồn quá mức.

**Ví dụ:** Hàng bán tốt không thiếu; hàng chậm không nhập thêm vô kiểm soát.

**Câu hỏi tiếp theo:** Nhóm hàng nào đang thiếu/rủi ro tồn?

**Hành động:** Kiểm tra báo cáo.

**Phân hệ liên quan:** Mua hàng

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Thiếu hàng

#### QA-0068 — Phát hiện thiếu hàng thế nào?

**Trả lời chuẩn:** Theo dõi tồn, nhu cầu bán, đơn chờ và thời gian hàng về; cảnh báo trước khi nguy hiểm.

**Ví dụ:** Mã A còn 20, nhu cầu 100, hàng về 20 ngày.

**Câu hỏi tiếp theo:** Có cần đặt ngay không?

**Hành động:** Tạo kế hoạch mua.

**Phân hệ liên quan:** Mua hàng

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Nhập dư

#### QA-0069 — Khi tồn cao có nên nhập tiếp?

**Trả lời chuẩn:** Không mặc định. Xem tốc độ bán, tồn và kế hoạch tiêu thụ.

**Ví dụ:** Tồn 6 tháng vẫn đặt thêm → cần đánh giá.

**Câu hỏi tiếp theo:** Đã có phương án xử lý tồn chưa?

**Hành động:** Báo vấn đề.

**Phân hệ liên quan:** Mua hàng

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Nhà cung cấp

#### QA-0070 — Đánh giá nhà cung cấp bằng gì?

**Trả lời chuẩn:** Giá, chất lượng, giao hàng, phản hồi và xử lý vấn đề.

**Ví dụ:** A giao đúng 95%, B đúng 70%.

**Câu hỏi tiếp theo:** Nguồn nào rủi ro?

**Hành động:** Tổng hợp đánh giá.

**Phân hệ liên quan:** Mua hàng

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Marketing & Thiết kế

### Hiệu quả

#### QA-0071 — Marketing hiệu quả là gì?

**Trả lời chuẩn:** Không chỉ làm nhiều bài/ảnh; phải phục vụ mục tiêu thương hiệu, bán hàng, sản phẩm và khách hàng, có kết quả để đo.

**Ví dụ:** 20 banner không được dùng không bằng 5 tài liệu được dùng hiệu quả.

**Câu hỏi tiếp theo:** Tài liệu này tạo kết quả gì?

**Hành động:** Xác định KR.

**Phân hệ liên quan:** Marketing

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Thiết kế

#### QA-0072 — Thiết kế tốt đo thế nào?

**Trả lời chuẩn:** Đúng mục tiêu, đối tượng, thông tin và nhận diện; được sử dụng và hạn chế sửa lặp lại.

**Ví dụ:** Bộ tài liệu được 8 nhân viên dùng và giảm thời gian chuẩn bị.

**Câu hỏi tiếp theo:** Sửa nhiều vì sao?

**Hành động:** Cải tiến đầu vào.

**Phân hệ liên quan:** Marketing

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Chiến dịch

#### QA-0073 — Có nên báo số bài đăng là kết quả?

**Trả lời chuẩn:** Số bài là hoạt động. Cần thêm kết quả như tiếp cận, quan tâm, cơ hội, khách hoặc hiệu quả chi phí tùy chiến dịch.

**Ví dụ:** 10 bài tạo 20 khách quan tâm tốt hơn 50 bài không tạo phản hồi.

**Câu hỏi tiếp theo:** Chiến dịch có KR gì?

**Hành động:** Liên kết chiến dịch.

**Phân hệ liên quan:** Chiến dịch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Phát triển sản phẩm

### Mục tiêu

#### QA-0074 — Phát triển sản phẩm hiệu quả là gì?

**Trả lời chuẩn:** Không phải làm nhiều mẫu; phải giải quyết nhu cầu thật, thử nghiệm có căn cứ, phản hồi rõ và tạo sản phẩm có khả năng bán.

**Ví dụ:** 1 mẫu có 5 khách thử có giá trị hơn 5 mẫu không ai thử.

**Câu hỏi tiếp theo:** Sản phẩm đang giải quyết nhu cầu gì?

**Hành động:** Xác định giả thuyết.

**Phân hệ liên quan:** Phát triển sản phẩm

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Cải tiến

#### QA-0075 — Khi nào nên cải tiến sản phẩm cũ?

**Trả lời chuẩn:** Khi dữ liệu bán hàng, phản hồi khách hoặc chất lượng cho thấy vấn đề/cơ hội đáng xử lý.

**Ví dụ:** Nhiều khách phản ánh khó lắp.

**Câu hỏi tiếp theo:** Phản hồi xuất hiện bao nhiêu lần?

**Hành động:** Tổng hợp dữ liệu.

**Phân hệ liên quan:** Phát triển sản phẩm

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Sản phẩm mới

#### QA-0076 — Các bước phát triển sản phẩm mới?

**Trả lời chuẩn:** Nhu cầu → cơ hội → nghiên cứu → mẫu → thử nghiệm → phản hồi → cải tiến → bán thử → đo kết quả.

**Ví dụ:** 10 khách thử, 7 khách chấp nhận.

**Câu hỏi tiếp theo:** Đang ở bước nào?

**Hành động:** Cập nhật dự án.

**Phân hệ liên quan:** Phát triển sản phẩm

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Lái xe

### Hiệu quả

#### QA-0077 — Lái xe hiệu quả là gì?

**Trả lời chuẩn:** Đưa nhân sự đi công tác an toàn, đúng giờ; xe luôn sẵn sàng; quản lý bảo dưỡng, bảo hiểm, đăng kiểm và hỗ trợ Kho khi không có lịch.

**Ví dụ:** Xe không hỏng đột xuất vì đã phát hiện và xử lý dấu hiệu sớm.

**Câu hỏi tiếp theo:** Lịch bảo dưỡng nào sắp đến?

**Hành động:** Kiểm tra lịch xe.

**Phân hệ liên quan:** Lái xe

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Xe

#### QA-0078 — Quản lý xe gồm gì?

**Trả lời chuẩn:** Tình trạng, bảo dưỡng, đăng kiểm, bảo hiểm, nhiên liệu, sửa chữa và chi phí.

**Ví dụ:** Xe có tiếng lạ → không chờ hỏng mới báo.

**Câu hỏi tiếp theo:** Có dấu hiệu bất thường không?

**Hành động:** Tạo cảnh báo.

**Phân hệ liên quan:** Lái xe

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Không có lịch lái

#### QA-0079 — Không có lịch lái xe thì làm gì?

**Trả lời chuẩn:** Ưu tiên kiểm tra và quản lý xe; sau đó hỗ trợ Kho theo phân công.

**Ví dụ:** Không có chuyến → kiểm tra xe và hỗ trợ Kho.

**Câu hỏi tiếp theo:** Kho cần hỗ trợ gì?

**Hành động:** Tạo kế hoạch.

**Phân hệ liên quan:** Kho, Lái xe

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Chiến dịch

### Khái niệm

#### QA-0080 — Chiến dịch là gì?

**Trả lời chuẩn:** Là chương trình có mục tiêu, phạm vi, thời gian, đối tượng, người phụ trách và kết quả riêng.

**Ví dụ:** Thử bán sản phẩm A cho 50 gara trong tháng 9.

**Câu hỏi tiếp theo:** Mục tiêu và hạn nào?

**Hành động:** Tạo chiến dịch.

**Phân hệ liên quan:** Chiến dịch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Theo dõi

#### QA-0081 — Chiến dịch nên theo dõi gì?

**Trả lời chuẩn:** Tiến độ, hoạt động, kết quả, phản hồi, chi phí nếu có và vấn đề phát sinh.

**Ví dụ:** 30/50 khách, 6 khách thử.

**Câu hỏi tiếp theo:** Điểm nghẽn là gì?

**Hành động:** Cập nhật chiến dịch.

**Phân hệ liên quan:** Chiến dịch

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Khác phân hệ

#### QA-0082 — Khi nào dùng Chiến dịch thay vì công việc thường ngày?

**Trả lời chuẩn:** Khi cần một chương trình có mục tiêu và thời gian riêng, có nhiều hoạt động phối hợp.

**Ví dụ:** Thử nghiệm bán một dòng mới cho nhóm gara cụ thể.

**Câu hỏi tiếp theo:** Có mục tiêu và thời hạn riêng không?

**Hành động:** Tạo chiến dịch.

**Phân hệ liên quan:** Kế hoạch, OKRs

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Thị trường kinh doanh

### Mục đích

#### QA-0083 — Báo cáo thông tin thị trường dùng để làm gì?

**Trả lời chuẩn:** Ghi nhận thông tin về khách hàng, đối thủ, giá, nhu cầu, xu hướng, sản phẩm và cơ hội mà công ty cần biết để ra quyết định.

**Ví dụ:** 18/30 khách phản ánh đối thủ giảm giá.

**Câu hỏi tiếp theo:** Thông tin đến từ bao nhiêu khách?

**Hành động:** Ghi nguồn và bằng chứng.

**Phân hệ liên quan:** Thị trường kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Khác biệt

#### QA-0084 — Thông tin thị trường khác Báo cáo tuần thế nào?

**Trả lời chuẩn:** Báo cáo tuần nói công việc và kết quả; thông tin thị trường nói điều đang xảy ra ngoài thị trường.

**Ví dụ:** “Tôi gọi 30 khách” = báo cáo tuần; “18 khách nói đối thủ giảm giá” = thị trường.

**Câu hỏi tiếp theo:** Thông tin có tính xu hướng không?

**Hành động:** Tổng hợp.

**Phân hệ liên quan:** Báo cáo tuần

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Nguồn

#### QA-0085 — Thông tin thị trường tốt cần gì?

**Trả lời chuẩn:** Nguồn, thời điểm, đối tượng, nội dung cụ thể, số trường hợp và mức độ tin cậy.

**Ví dụ:** 18/30 khách miền Bắc phản ánh cùng một vấn đề.

**Câu hỏi tiếp theo:** Có thể xác nhận thêm không?

**Hành động:** Thu thập thêm.

**Phân hệ liên quan:** Thị trường kinh doanh

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## Trợ lý Bảng tin

### Mục đích

#### QA-0086 — Bảng tin dùng để làm gì?

**Trả lời chuẩn:** Truyền đạt thông tin chung: thông báo điều hành, kế hoạch hàng hóa, thông báo toàn công ty, hoạt động chung, định hướng và ghi nhận.

**Ví dụ:** Thông báo đào tạo hoặc kế hoạch hàng về.

**Câu hỏi tiếp theo:** Thông tin này có cần toàn công ty biết không?

**Hành động:** Chọn loại tin.

**Phân hệ liên quan:** Bảng tin

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Điều hành

#### QA-0087 — Thông báo điều hành là gì?

**Trả lời chuẩn:** Quyết định hoặc thay đổi cách làm mà toàn công ty cần biết.

**Ví dụ:** Từ 01/09 áp dụng quy trình mới.

**Câu hỏi tiếp theo:** Ai cần biết và từ khi nào?

**Hành động:** Đăng thông báo.

**Phân hệ liên quan:** Bảng tin

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Hàng hóa

#### QA-0088 — Kế hoạch hàng hóa nên đăng gì?

**Trả lời chuẩn:** Hàng sắp về, hàng mới, thay đổi sản phẩm hoặc thông tin hàng hóa liên quan nhiều bộ phận.

**Ví dụ:** 500 sản phẩm A dự kiến về 05/09.

**Câu hỏi tiếp theo:** Bộ phận nào cần chuẩn bị?

**Hành động:** Đăng thông tin.

**Phân hệ liên quan:** Bảng tin

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

### Phân biệt

#### QA-0089 — Có nên đăng báo cáo vấn đề nghiệp vụ lên Bảng tin?

**Trả lời chuẩn:** Không nếu vấn đề thuộc phân hệ riêng. Bảng tin chỉ đưa thông tin chung mà toàn công ty cần biết hoặc hành động.

**Ví dụ:** Vấn đề bảo hành chi tiết nằm ở Báo cáo vấn đề; quyết định chung mới lên Bảng tin.

**Câu hỏi tiếp theo:** Thông tin có cần toàn công ty biết không?

**Hành động:** Phân loại.

**Phân hệ liên quan:** Báo cáo vấn đề

**Vai trò:** Tất cả

**Mức độ:** Cơ bản

**Ưu tiên:** Cao

**Không tự đoán:** Không tự bịa số liệu hoặc thông tin chưa có trong hệ thống.

---

## 4. LUỒNG TƯ DUY CHUNG CHO CHATBOT

```text
MỤC TIÊU / OKRs
      ↓
KẾ HOẠCH
      ↓
THỰC HIỆN
      ↓
BÁO CÁO TUẦN
      ↓
CHECK-IN HÀNG TUẦN
      ↓
PHÁT HIỆN VẤN ĐỀ
      ↓
BÁO CÁO + ĐỀ XUẤT
      ↓
PHỐI HỢP / TÌM ĐÚNG NGƯỜI
      ↓
THEO ĐẾN KHI CÓ KẾT QUẢ
      ↓
KIỂM TRA KẾT QUẢ
      ↓
CẢI TIẾN
```

## 5. GHI CHÚ VỀ PHẠM VI HIỆN TẠI

- Bộ này đã có **kiến thức phương pháp, tình huống nghiệp vụ, câu hỏi gợi mở và nguyên tắc trả lời**.
- Chưa có lớp **hướng dẫn thao tác giao diện cụ thể** kiểu “vào màn hình nào → bấm nút nào → nhập trường nào”, vì phần đó cần lấy từ đặc tả giao diện thực tế của phần mềm.
- Có thể tiếp tục mở rộng bằng cách thu thập câu hỏi thực tế nhân viên hỏi chatbot và bổ sung từng câu vào đúng trợ lý.

## 6. DANH SÁCH TRỢ LÝ HIỆN CÓ

- Bộ não chung công ty
- Trợ lý OKRs
- Trợ lý Kế hoạch
- Trợ lý Báo cáo tuần
- Trợ lý Check-in hàng tuần
- Trợ lý Báo cáo vấn đề
- Trợ lý Khách hàng
- Trợ lý Kinh doanh
- Trợ lý Kho
- Trợ lý Tổng hợp kho
- Trợ lý Bảo hành
- Trợ lý Kế toán
- Trợ lý Mua hàng
- Trợ lý Marketing & Thiết kế
- Trợ lý Phát triển sản phẩm
- Trợ lý Lái xe
- Trợ lý Chiến dịch
- Trợ lý Thị trường kinh doanh
- Trợ lý Bảng tin