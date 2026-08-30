# Spec: Chatbot Trợ lý công việc — Widget nổi + Trang /tro-ly (Supabase search)

> Ngày: 2026-08-30
> Trạng thái: Draft — chờ review trước khi lập kế hoạch triển khai
> Nguồn dữ liệu: `Bo_du_lieu_chatbot_tro_ly_cong_viec_toan_cong_ty.md` (91 QA, 18 trợ lý)
> Quyết định khóa tại brainstorming 2026-08-30 (user duyệt “ok”)

## 1) Tổng quan

Thêm hệ thống chatbot trả lời dựa trên bộ 91 QA cố định, **không gọi AI API ở giai đoạn 1**, nhưng đặt sẵn interface để cắm AI sau mà không sửa UI.

- Hai mặt tiền dùng chung một API search:
  - **Widget nổi** hiện ở mọi trang (desktop: hộp 380×560; mobile: bottom sheet 92dvh).
  - **Trang `/tro-ly`** — tra cứu toàn bộ QA theo phân hệ (bộ lọc trái + kết quả phải).
- Biết đang ở trang nào để **ưu tiên QA cùng phân hệ**, fallback toàn bộ khi không khớp.
- Tuân thủ nguyên tắc “Không tự đoán”: khi không khớp ngưỡng thì thừa nhận, gợi ý từ khóa, dẫn đúng phân hệ liên quan và cho phép ghi lại câu hỏi.

## 2) Mục tiêu / Phi mục tiêu

**Mục tiêu (GĐ1):**
- Seed 91 QA vào Supabase, search server-side bằng `pg_trgm` + `tsvector` tiếng Việt.
- `GET /api/chatbot?q=&context=&limit=` trả top 3 QA kèm score; `POST /api/chatbot/log` ghi câu hụt.
- Widget + `/tro-ly` hoạt động đúng kích thước/cách dùng đã chốt, không che nội dung chính, accessible (Esc, focus trap, aria-dialog).
- Log câu không khớp vào `chatbot_queries` để bổ sung QA sau.

**Phi mục tiêu (để GĐ2):**
- Gọi AI (LLM) để viết lại / tổng hợp câu trả lời.
- Admin UI sửa QA trong app (CRUD QA) — chỉ seed bằng script ở GĐ1.
- Lịch sử hội thoại đa phiên, đăng nhập riêng cho bot, voice.

## 3) Quyết định đã khóa (không hỏi lại)

| # | Quyết định | Giá trị |
|---|-----------|---------|
| 1 | Vị trí | Widget nổi mọi trang + trang `/tro-ly` |
| 2 | Cách trả lời | A — khớp từ khóa trong 91 QA, để slot cắm AI sau |
| 3 | Ngữ cảnh | Biết pathname → ưu tiên QA cùng phân hệ |
| 4 | Desktop | Hộp 380×560, bo 16px, cao min(560px, 80vh), bóng 0 8px 32px |
| 5 | Mobile | Bottom sheet 100% × 92dvh, bo trên 16px, nền mờ, vuốt đóng |
| 6 | Mở lần đầu | Chào ngắn theo phân hệ + 3–4 chip gợi ý (lấy từ QA top của phân hệ) |
| 7 | Tin nhắn | Đầy đủ: Trả lời chuẩn + Ví dụ + Câu hỏi tiếp theo (chip) + Hành động |
| 8 | Không khớp | Thừa nhận “chưa có dữ liệu, không tự đoán” + gợi ý từ khóa + dẫn phân hệ liên quan + nút ghi lại |
| 9 | Dữ liệu | B — Supabase + API search server-side |

## 4) Kiến trúc

```
[Widget nổi (client)] ──┐
                        ├─→ GET /api/chatbot?q=&context=&limit=3 ─→ Supabase: chatbot_qa
[Trang /tro-ly (client)]┘                                          (pg_trgm gin + tsvector)
                        └─→ POST /api/chatbot/log ─→ chatbot_queries
                                   ↑
                          searchQA(query, context) — hàm server duy nhất
                          Slot AI tương lai: wrap searchQA, không đụng UI
```

- Một hàm server `searchQA` là nguồn chân lý; widget và `/tro-ly` chỉ khác render.
- Không search ở client để giữ QA tập trung một chỗ và dễ mở rộng khi lên 500–1000 QA.

## 5) Mô hình dữ liệu (Supabase)

**`chatbot_qa`**

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | `text PK` | `QA-0001` … `QA-0091` (giữ nguyên ID trong file .md) |
| `phan_he` | `text` | Ví dụ: `Trợ lý OKRs`, `Bộ não chung công ty` |
| `nhom_chu_de` | `text` | Ví dụ: `Xây O`, `Check-in` |
| `cau_hoi` | `text` | Câu hỏi chuẩn |
| `tra_loi_chuan` | `text` | |
| `vi_du` | `text` | |
| `cau_hoi_tiep_theo` | `text` | Dùng làm chip gợi ý |
| `hanh_dong` | `text` | |
| `phan_he_lien_quan` | `text[]` | Để dẫn link khi không khớp |
| `vai_tro` | `text` | |
| `muc_do` | `text` | |
| `uu_tien` | `text` | |
| `du_lieu_can_co` | `text` | |
| `khong_tu_doan` | `text` | |
| `search_text` | `tsvector` | `to_tsvector('simple', cau_hoi || ' ' || tra_loi_chuan || ' ' || vi_du)` — dùng `simple` để tránh phụ thuộc dict tiếng Việt chưa cài; có thể đổi `vietnamese` nếu extension có sẵn |
| `search_norm` | `text` | Bản không dấu, lowercase để trigram match “bao cao” = “báo cáo” |

Index:
- `GIN (search_text)`
- `GIN (search_norm gin_trgm_ops)` — cần `pg_trgm`
- `INDEX (phan_he)`

**`chatbot_queries`** (log câu hụt)

| Cột | Kiểu |
|-----|------|
| `id` | `uuid PK` |
| `user_id` | `uuid FK profiles(id) nullable` |
| `query` | `text` |
| `context` | `text` |
| `created_at` | `timestamptz default now()` |

RLS:
- `chatbot_qa`: `authenticated` được `SELECT`; chỉ `service_role` được `INSERT/UPDATE/DELETE` (seed bằng admin client).
- `chatbot_queries`: `authenticated` được `INSERT` dòng của chính mình (`user_id = auth.uid()`); `SELECT` chỉ cho role có `quan_ly_cai_dat` hoặc `quan_ly_nguoi_dung` (để xem log bổ sung QA). Dùng `has_permission()` sẵn có.

Migration: `supabase/migrations/0028_chatbot.sql` (tạo extension `pg_trgm` nếu chưa có, tạo 2 bảng, index, RLS). Seed bằng `scripts/seed-chatbot.mjs` (parse file .md → upsert 91 dòng, idempotent).

## 6) API

### `GET /api/chatbot`

Query: `q` (bắt buộc, trim, 1–200 ký tự), `context` (optional, pathname hoặc slug phân hệ), `limit` (default 3, max 5).

Xử lý:
1. Validate `q`; nếu rỗng → 400.
2. Chuẩn hoá `q_norm` = lowercase + bỏ dấu + bỏ ký tự đặc biệt.
3. SQL (admin client):
   ```sql
   select id, phan_he, nhom_chu_de, cau_hoi, tra_loi_chuan, vi_du,
          cau_hoi_tiep_theo, hanh_dong, phan_he_lien_quan,
          (similarity(search_norm, :q_norm) * 0.6
           + ts_rank(search_text, plainto_tsquery('simple', :q)) * 0.3
           + case when phan_he = :context_phan_he then 0.15 else 0 end) as score
   from chatbot_qa
   order by score desc
   limit :limit;
   ```
   - Cần map `context` (pathname) → `phan_he` qua bảng `CONTEXT_MAP` (ví dụ `/okr` → `Trợ lý OKRs`, `/khach-hang` → `Trợ lý Khách hàng`, `/` → `Bộ não chung công ty`). Nếu không map được thì bỏ `context_boost`.
4. Lọc `score < 0.20` → coi như không khớp (trả `matches: []` + `suggestions` là 2–3 `cau_hoi` gần nhất theo trigram).
5. Trả JSON: `{ matches: QA[], suggestions: string[], context: string }`.

Auth: yêu cầu `Authorization: Bearer <supabase access_token>` (dùng anon client verify), nhưng cho phép `GET` không auth vẫn trả kết quả (để widget hoạt động khi chưa đăng nhập thì chỉ thiếu log). Quyết định cuối: **yêu cầu auth** để đồng nhất với các API khác — nếu không có token thì vẫn trả 200 nhưng không ghi log.

Rate limit: không cần ở GĐ1 (đã có Supabase rate limit); có thể thêm check `q.length` và debounce ở client 300ms.

### `POST /api/chatbot/log`

Body: `{ query: string, context: string }`. Ghi vào `chatbot_queries`. Yêu cầu auth; nếu không auth thì bỏ qua (không lỗi).

## 7) UI — Widget nổi

**Nút nổi:**
- Vị trí `fixed; right: 20px; bottom: 20px; z-index: 50`, tròn `56px`, nền `#0d6efd`, icon chat (stroke 2), bóng `0 4px 16px rgba(0,0,0,.2)`.
- `aria-label="Mở trợ lý"`, `title`.

**Hộp chat (desktop ≥768px):**
- `width: 380px; height: min(560px, 80dvh); border-radius: 16px`, bóng `0 8px 32px rgba(0,0,0,.18)`, `overflow: hidden`, flex column.
- Header `48px`: tên trợ lý theo `context` (ví dụ “Trợ lý OKRs”), nút đóng `×`.
- Body scroll: danh sách bong bóng (user phải xanh, bot trái trắng/xám), mỗi trả lời hiện đủ 4 khối như §8, kèm chip.
- Input dính đáy: `textarea` 1 dòng auto-grow tối đa 3 dòng + nút gửi. Enter gửi, Shift+Enter xuống dòng.
- A11y: `role="dialog" aria-modal="true"`, focus trap, `Esc` đóng, focus trả về nút nổi khi đóng.

**Bottom sheet (mobile <768px):**
- Nền mờ `fixed inset-0 bg-black/35` bấm đóng.
- Sheet `fixed bottom-0 left-0 right-0 height: 92dvh; border-radius: 16px 16px 0 0`, trượt lên `280ms ease-out`.
- Vuốt xuống >80px hoặc bấm nền mờ thì đóng. Input luôn nổi trên bàn phím (dùng `dvh`).
- Nút nổi vẫn `56px` nhưng `right: 16px; bottom: 16px` trên mobile.

**Trạng thái:**
- Đặt trong `AppSidebar` (hoặc `layout.tsx`) để có mặt ở mọi trang, không mount lại khi đổi route.
- State: `open`, `messages: {role, content, qaId?}[]`, `suggestions` (chip), `loading`.

## 8) Nội dung tin nhắn (đầy đủ theo QA)

Mỗi `match` render:
- **Trả lời chuẩn** — đậm, 14px.
- **Ví dụ** — nền `bg-slate-50`, viền trái `border-l-2 border-slate-200`, 13px.
- **Câu hỏi tiếp theo** — chip bấm được (bấm là gửi luôn câu đó).
- **Hành động** — dòng gợi ý 13px `text-slate-500`.
- Footer nhỏ: `QA-00xx` + nút Sao chép + nút “Xem chi tiết” (mở dialog đầy đủ nếu cần).

Chip chuyển tiếp dưới mỗi trả lời: `Ví dụ` / `Liên quan` / `Hỏi tiếp` — bấm là gửi query tương ứng.

## 9) Khi mở lần đầu

- 1 bong bóng chào ngắn theo `context` (map như §6).
- 3–4 chip gợi ý lấy từ top QA của phân hệ đó (ưu tiên `uu_tien = Cao`).
- Bấm chip là gửi luôn, không cần gõ.

## 10) Khi không khớp (score < 0.20)

Hiện một bong bóng đặc biệt:
- Dòng 1: “Chưa có dữ liệu để trả lời — mình không tự đoán.” (đúng nguyên tắc file)
- Dòng 2: Gợi ý 2–3 từ khóa gần nhất (`suggestions`).
- Dòng 3: Dẫn đúng phân hệ liên quan (lấy `phan_he_lien_quan` của QA gần nhất, hoặc fallback `Bộ não chung`) với link tới trang tương ứng.
- Nút “Ghi lại câu hỏi này” → `POST /api/chatbot/log`.

## 11) Trang `/tro-ly`

- Route `src/app/tro-ly/page.tsx` (cần quyền `xem_okr` hoặc tương đương — hoặc mở cho mọi `authenticated` vì là trợ lý chung).
- Layout 2 cột: trái `240px` bộ lọc 18 trợ lý (All + 17 nhóm), phải là ô tìm kiếm + danh sách kết quả accordion.
- Ô tìm kiếm debounce 300ms, gọi cùng `GET /api/chatbot`.
- Bấm một QA mở dialog đầy đủ trường (dùng `Dialog` sẵn có).
- Dùng chung ranking với widget nên kết quả đồng nhất.

## 12) Slot AI tương lai (không làm ở GĐ1)

- Đặt interface `searchQA(query, context): Promise<QA[]>` ở `src/lib/chatbot/search.ts` (server).
- GĐ1: `searchQA` là trigram+tsvector thuần.
- GĐ2: thêm `searchQAWithAI` wrap `searchQA` — khi `matches` rỗng hoặc score thấp thì gọi LLM để diễn đạt lại dựa trên QA gần nhất, vẫn kèm `qaId` nguồn và không tự bịa số liệu. UI không đổi.

## 13) Bảo mật & quyền

- RLS như §5.
- API `GET` yêu cầu `Authorization` nhưng không chặn hard ở GĐ1 để widget vẫn hữu ích khi token hết hạn (chỉ mất log).
- `POST /log` bắt buộc auth.
- Không lộ `service_role` ra client; mọi query qua admin client ở API route.

## 14) Kiểm thử

- **Unit** (`vitest`): `normalizeQuery` (bỏ dấu, lowercase), `mapContextToPhanHe`, ranking helper, ngưỡng 0.20.
- **API test**: `GET /api/chatbot?q=OKRs là gì` trả `QA-0012`; `q` không khớp trả `matches: []` + `suggestions`.
- **E2E** (`playwright` nếu có): mở widget, gửi “OKRs là gì”, thấy `QA-0012`; trên mobile bottom sheet vuốt đóng.
- **Seed idempotent**: chạy `seed-chatbot.mjs` 2 lần không tạo trùng.

## 15) Triển khai

1. Migration `0028_chatbot.sql` + `seed-chatbot.mjs` (parse .md).
2. `src/lib/chatbot/*` (normalize, context map, search helper).
3. `src/app/api/chatbot/route.ts` + `src/app/api/chatbot/log/route.ts`.
4. `src/components/ChatbotWidget.tsx` + mount trong `AppSidebar`/`layout`.
5. `src/app/tro-ly/page.tsx`.
6. Thêm link “Trợ lý” vào `AppSidebar.LINKS` (badge không cần).
7. Manual QA trên desktop + mobile trước khi merge.

## 16) Rủi ro & giảm thiểu

- `tsvector` tiếng Việt: dùng `simple` trước; nếu cài được `pg_trgm` + `unaccent` thì thêm cột `search_norm` để match không dấu.
- Ngưỡng 0.20 quá chặt/lỏng: để configurable trong code, chỉnh sau khi thử với 20 query thực tế.
- Widget che nội dung: đã chọn 380×560 nhỏ gọn + `z-index` vừa phải; trên màn <1024px có thể thu nhỏ còn 340px (media query).

---

## Self-review (viết xong soát)

- [x] Không còn TBD/TODO — mọi ngưỡng, kích thước, bảng, API đã chốt.
- [x] Nhất quán: widget + /tro-ly dùng chung `searchQA` và cùng ranking.
- [x] Phạm vi vừa một plan: GĐ1 không kèm AI hay admin CRUD.
- [x] Không mơ hồ: `context` map, score formula, ngưỡng 0.20, RLS đều ghi rõ.
