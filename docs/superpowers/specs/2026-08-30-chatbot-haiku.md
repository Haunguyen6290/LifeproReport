# Chatbot — Haiku AI (fallback + nâng cao)

**Ngày:** 2026-08-30
**Spec cũ:** docs/superpowers/specs/2026-08-30-chatbot-design.md (giữ nguyên phần keyword rank, thêm AI)

**Goal:** Thêm lớp Haiku vào chatbot để xử lý câu hỏi tự nhiên kiểu "làm thế nào", "cụ thể hơn" — mà rankQA bị loạn vì đếm token trùng lặp.

**Architecture:** Giữ nguyên `rankQA` lọc top 5 QA gần nhất → gửi 5 QA + câu hỏi (hoặc 6 tin gần nhất nếu có lịch sử) cho Haiku qua API key trong `Cài đặt chung > Trợ lý AI` → Haiku **chỉ chọn 1 id** hoặc trả **`null`** (nếu 5 QA đều không đúng ý) → server: id hợp lệ → trả nguyên văn `tra_loi_chuan` + `vi_du` từ DB; null → Haiku tự trả lời bằng kiến thức của nó nhưng gắn nhãn nhỏ **"Gợi ý từ AI — không phải quy chuẩn công ty"**, và đếm trong quota (mặc định 5 tin AI/phiên). Lỗi mạng / key trống / quá 5s → tự rơi về `rankQA` top 1 như cũ.

## Cài đặt chung

Bảng `settings` (không cần migration) — key/value kiểu cũ + công tắc bật/tắt.

- `AI_ENABLED` = `TRUE`/`FALSE`
- `AI_KEY`      = API key (UI mask)
- `AI_ENDPOINT` = vd `https://node1.viber.vn/api/v1/llm`
- `AI_MODEL`    = mặc định `claude-haiku-4-5`
- `AI_FREE_MSG_LIMIT` = `5`/`10`

UI thêm card **"Trợ lý AI (Haiku)"** vào `/quan-tri/cai-dat`:
- Công tắc bật/tắt (tắt → 100% rankQA, 0 đồng)
- Ô API key (kiểu `password`, hiện mask)
- Ô Endpoint
- Ô Model (mặc định `claude-haiku-4-5`)
- Ô Giới hạn tin AI tự do / phiên (select 5/10)

## API

`src/app/api/chatbot/route.ts` hiện tại GET → đổi thành POST (vì cần gửi `messages: [{q, history}]`) để giữ state phía server, hoặc vẫn GET nhưng gửi body. Đơn giản nhất: đổi sang POST `application/json` với `{ q, context, messages: [{role, content}], aiUsedCount }`.

- `messages` = lịch sử gần nhất (tối đa 6 tin, mỗi tin 100-200 ký tự) để Haiku hiểu "nó", "cái đó".
- `aiUsedCount` = số tin AI tự do (loại null) đã dùng trong phiên; server kiểm tra `>= AI_FREE_MSG_LIMIT` thì chuyển null sang "Hết lượt AI nâng cao, vui lòng hỏi câu chuẩn".
- Server luôn chạy `rankQA` trước → lấy top 5; nếu `AI_ENABLED=FALSE` hoặc key rỗng → trả top 1 rankQA như hiện tại.
- Nếu có AI: gọi `POST {AI_ENDPOINT}/v1/messages` (Anthropic SDK) với:
  - `model: AI_MODEL`
  - system: "Bạn là trợ lý công việc nội bộ. Trong danh sách câu hỏi QA sau (id + question), chọn ĐÚNG 1 câu khớp nhất với ý người dùng và trả JSON: `{\"type\":\"qa\",\"id\":\"QA-0021\"}`. Nếu không có câu nào đúng ý (hỏi kỹ hơn, ngoài 5 QA), trả `{\"type\":\"ai\",\"text\":\"<trả lời bằng kiến thức, ≤4 câu, tiếng Việt, không bịa số liệu>\"}`. Không giải thích gì thêm."
  - messages: `[...history, {role:'user', content: q}]`
  - `max_tokens: 300`, `temperature: 0.2`
- Parse JSON trả về: nếu không phải JSON hợp lệ hoặc id không có trong top 5 → thử lại 1 lần, vẫn lỗi → fallback rankQA.

## Widget

`src/components/ChatbotWidget.tsx`:
- State `aiUsed: number` (đếm tin null).
- `type Msg` mở rộng: `| {id; role:'bot-ai'; text: string}`
- Hiển thị `bot-ai`: khung tím nhạt (bg `#f3e8ff`, border `#d8b4fe`), dòng nhỏ dưới text: `Gợi ý từ AI — không phải quy chuẩn công ty`.
- Khi `aiUsed >= AI_FREE_MSG_LIMIT` server trả `type:'limit'` → hiển thị thông báo hết lượt.

## Fallback (không bao giờ lỗi)

Mọi lỗi AI (timeout, mạng, key sai, parse fail) → dùng `rankQA` top 1 hiện có, kèm `meta.fallback = 'ai-unavailable'` để widget có thể hiện dấu nhỏ "Chế độ offline (AI không khả dụng)".

## Bảo mật

- `AI_KEY` không bao giờ ra client: route API đọc trực tiếp từ `settings` qua `createAdminClient`, không trả key cho widget.
- Chỉ admin (`quan_ly_cai_dat`) mới được đọc/sửa `AI_KEY` trong Cài đặt chung.
- Log mọi lời gọi AI sang `chatbot_queries` (kèm `kind: 'ai-call' | 'ai-null' | 'ai-fallback'`, `tokens_in`, `tokens_out`).

## Chi phí ước lượng

Haiku $1/$5/MTok. Mỗi câu: input ~800 token (600 prompt + 200 history), output ~10-150. Trung bình **$0.0009-0.002/câu**. 100 người × 20 câu/ngày ≈ **$1.8-4/ngày**, **$50-120/tháng**. Tắt khi cần.

## Không đổi

- `rankQA`, `normalize`, `context`, `mapContextToPhanHe`, RLS — giữ nguyên hoàn toàn.
- Trang `/tro-ly` (chỉ xem QA, không AI).
- Widget UI (380×560 + bottom-sheet 92dvh, overlay pointer-events).
