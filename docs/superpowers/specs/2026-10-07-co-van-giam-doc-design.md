# Cố vấn Giám đốc — Đặc tả

> Ngày: 07/10/2026 · Người dùng: chỉ Giám đốc (quyền `quan_ly_cai_dat`) · Nhân viên không thấy, không biết có AI.

## 1. Mục đích

Phần mềm đang là máy nhập liệu: nhân viên điền Kế hoạch tuần, Báo cáo tuần là xong, không ai đọc kỹ chất lượng. Cố vấn Giám đốc là một trợ lý AI riêng của ông, thay ông đọc toàn bộ, chấm theo chuẩn quản trị, báo ông chỗ nào kém hoặc có dấu hiệu đối phó, và soạn sẵn góp ý để ông gửi cho nhân viên bằng một lần bấm.

## 2. Ông dùng nó ở đâu

Một bộ não, hai chỗ nói chuyện:

| Chỗ | Dùng để |
|-----|---------|
| Trang `/co-van` trong phần mềm | Xem danh sách bài đã chấm, đọc lý do, sửa góp ý, bấm Gửi / Bỏ qua, chat hỏi đáp |
| Telegram nhắn riêng 1-1 với bot | Nhận cảnh báo ngay khi có bài kém, bấm nút Gửi / Bỏ qua, nhắn hỏi như chat |

Nhóm Telegram chung của công ty giữ nguyên như hiện tại. Tin chấm bài chỉ đi vào chat riêng của ông.

## 3. Nó tự chạy như thế nào

1. Nhân viên bấm lưu Kế hoạch tuần hoặc Báo cáo tuần → hệ thống gọi chấm ngầm (giống cách đang bắn Telegram, nhân viên không phải chờ).
2. Mỗi sáng 7h có một lượt quét bù: bài nào chưa chấm hoặc đã sửa sau lần chấm trước thì chấm lại.
3. Claude đọc bài + kế hoạch tuần trước + OKR của người đó, trả về: **Đạt / Cần sửa / Không đạt**, lý do, dấu hiệu đối phó (nếu có), và một đoạn góp ý soạn sẵn.
4. Bài **Cần sửa / Không đạt** → báo ông qua Telegram riêng + hiện trên `/co-van`. Bài **Đạt** chỉ lưu, không làm phiền ông.
5. Ông bấm **Gửi** → góp ý hiện cho nhân viên dưới bài của họ, đứng tên ông (như ông tự viết). Bấm **Bỏ qua** → không gửi gì.

Giai đoạn đầu mọi góp ý phải qua một lần bấm của ông. Sau 2–4 tuần nếu ông thấy nó chấm đúng ý, có công tắc **Tự gửi** để bỏ qua bước bấm.

## 4. Tiêu chuẩn chấm (con soạn sẵn, ông không cần cài)

Dùng lại bản giới thiệu công ty đang có trong Cài đặt AI (B2B đại lý, vai trò từng bộ phận, chuẩn "đạt"), cộng thêm:

**Kế hoạch tuần đạt khi:**
- Mỗi việc có đối tượng cụ thể (khách nào, mã hàng nào, chiến dịch nào), không viết "làm việc với khách hàng".
- Có kết quả cần đạt đo được bằng số và ngày làm.
- Nối được vào OKR / KR đang chạy, hoặc nói rõ vì sao làm việc ngoài OKR.
- Khối lượng hợp lý với một tuần (không 2 việc cho cả tuần, không 25 việc làm cho có).

**Báo cáo tuần đạt khi:**
- Đối chiếu từng việc của kế hoạch: xong / một phần / chưa, có số liệu.
- Việc chưa xong có nguyên nhân thật và bước tiếp theo, không phải "đang triển khai".
- Có khó khăn và đề xuất cụ thể.
- Tỷ lệ hoàn thành tự khai khớp với chi tiết từng dòng.

**Dấu hiệu đối phó cần báo riêng ông:**
- Chép lại gần nguyên văn kế hoạch / báo cáo các tuần trước.
- Tự chấm 100% nhưng chi tiết không có kết quả.
- Việc hứa tuần trước biến mất khỏi báo cáo, không giải thích.
- Nộp sát hạn, nội dung ngắn bất thường so với chính người đó.

Ông muốn chỉnh thì chỉ cần nhắn trong chat, ví dụ "chấm Kho nhẹ tay hơn", nó lưu thành ghi chú bổ sung cho các lần chấm sau.

## 5. Hỏi đáp trong chat

Ông hỏi tự nhiên, nó trả lời dựa trên dữ liệu thật:
- "Tuần này ai làm dở nhất?" · "Tóm tắt team Kinh doanh tuần trước" · "Bình 4 tuần gần đây thế nào?"
- Sáng thứ Hai tự gửi ông một bản tổng kết tuần: ai tốt, ai kém, ai cần ông gọi riêng.

Giai đoạn 1 nó chỉ đọc Kế hoạch, Báo cáo, OKR. Doanh số, công nợ, lãi gộp nối vào ở giai đoạn sau (mục 8).

## 6. Dữ liệu mới

Hai bảng, chỉ người có `quan_ly_cai_dat` đọc được:

- `co_van_danh_gia`: mỗi lần chấm một bài — loại bài (kế hoạch / báo cáo), id bài, nhân viên, tuần, kết quả, lý do, dấu hiệu đối phó, góp ý soạn sẵn, trạng thái (Chờ ông / Đã gửi / Bỏ qua), thời điểm gửi, phiên bản bài lúc chấm (để biết bài đã sửa sau đó).
- `co_van_tin_nhan`: lịch sử chat giữa ông và cố vấn (web + Telegram chung một luồng).

Khi ông bấm Gửi, góp ý đi vào đúng chỗ nhân viên đang xem:
- Báo cáo tuần → một dòng trong luồng "Góp ý của quản lý" (`weekly_report_comments`) đứng tên ông.
- Kế hoạch tuần → ô "Ý kiến quản lý" của kế hoạch. Nếu ô đã có ý kiến ông tự viết thì nối thêm, không ghi đè.

Không sửa, không xóa bất kỳ dữ liệu cũ nào.

## 7. Kết nối

- **AI:** dùng chung API Key, Endpoint, Model đang cài ở Cài đặt → Trợ lý AI. Công tắc "Bật Trợ lý AI" hiện tại chỉ áp cho chatbot nhân viên; Cố vấn chạy được khi có key, kể cả lúc chatbot nhân viên đang tắt.
- **Telegram:** dùng lại bot hiện tại. Ông nhắn riêng `/start` cho bot một lần, hệ thống ghi nhận chat riêng của ông. Bot chỉ trả lời đúng chat riêng đó, tin từ bất kỳ ai khác bị bỏ qua. Webhook có mã bí mật để người ngoài không giả tin được.
- **Lưu ý kỹ thuật:** khi bật webhook, nút "Lấy Group ID" trong Cài đặt sẽ chuyển sang đọc từ tin bot nhận được thay vì gọi trực tiếp Telegram (Telegram không cho dùng cả hai cách cùng lúc).

## 8. Các giai đoạn

| GĐ | Nội dung | Ông cần làm |
|----|----------|-------------|
| 1 | Trang `/co-van`: chấm tự động Kế hoạch + Báo cáo tuần, danh sách duyệt, Gửi / Bỏ qua, chạy thử trên tuần này | Vào xem, nói đúng / chưa đúng ý |
| 2 | Telegram riêng: cảnh báo + nút bấm + nhắn hỏi | Nhắn `/start` cho bot |
| 3 | Chat hỏi đáp có số liệu Doanh số, Công nợ; tổng kết sáng thứ Hai | Không |
| 4 | Báo cáo Lãi gộp + đề xuất cải tiến → nháp OKR / kế hoạch tháng để ông duyệt | Cho biết nguồn giá vốn (file MISA hay số tồn hiện có) |

## 9. Chi phí và rủi ro

- **Chi phí:** khoảng vài trăm đồng mỗi bài, cả công ty cỡ 50–100 nghìn đồng / tháng, trừ vào tài khoản API đang dùng.
- **Dữ liệu ra ngoài:** nội dung kế hoạch / báo cáo được gửi sang Anthropic để chấm. Anthropic không dùng dữ liệu API để huấn luyện. Khi nối số liệu tiền (GĐ3–4) sẽ chỉ gửi số tổng hợp cần thiết.
- **AI chấm sai:** vì vậy giai đoạn đầu mọi góp ý qua tay ông. Nếu API lỗi hoặc hết tiền, phần mềm vẫn chạy bình thường, chỉ không có chấm.
- **Nhân viên phát hiện:** góp ý đứng tên ông, viết theo giọng người anh / cố vấn (chỉ rõ thiếu gì, gợi ý cách sửa), không chấm điểm số công khai.
