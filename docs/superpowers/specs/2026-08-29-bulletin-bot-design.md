# Bulletin + Weekly Bot Design Spec — 2026-08-29

**Mảnh:** A (Bảng tin) + C (Bot 8h30 thứ 2). Làm chung 1 đợt vì bot đăng lên bảng tin (phụ thuộc A).

## 1) Mục tiêu
- Bảng tin: chỉ Admin/Quản lý được đăng (kèm ảnh, tag @ bằng cách gõ @Tên). Nhân viên chỉ xem + bình luận. Mỗi bộ phận thấy đúng mẫu theo vai trò (đã làm cho OKRs) — bảng tin thì tất cả xem được, nhưng tag @ liên phòng được.
- Bot: 8h30 thứ 2 hàng tuần tự kiểm tra 7 việc, gom danh sách "chưa làm" và tạo 1 bài trên Bảng tin (kèm tag @ đúng người). Chạy trên máy chủ (Vercel Cron 0 30 8 * * 1), không cần máy ông bật.

## 2) 7 việc bot kiểm tra (Admin tích/bỏ tích trong Cài đặt chung)
1. Chưa tạo OKR cá nhân cho kỳ hiện tại
2. Chưa nộp Kế hoạch tuần (tuần này, hạn thứ 2)
3. Chưa nộp Báo cáo tuần (tuần trước)
4. Chưa có Báo cáo kho trong 7 ngày
5. Không đăng nhập quá 7 ngày
6. Tuần rồi không có Tin thị trường mới
7. Tuần rồi không có Cập nhật Chiến dịch

Settings keys: BOT_CHECK_OKR, BOT_CHECK_KE_HOACH_TUAN, BOT_CHECK_BAO_CAO_TUAN, BOT_CHECK_BAO_CAO_KHO, BOT_CHECK_DANG_NHAP, BOT_CHECK_TIN_THI_TRUONG, BOT_CHECK_CHIEN_DICH — giá trị 'TRUE'/'FALSE'. Mặc định TRUE hết. Seed trong migration.

## 3) Bảng tin — DB
- `bulletin_posts` (id uuid, author_id uuid -> profiles, title text, content text, mentioned_user_ids uuid[], created_at, is_bot boolean default false)
- `bulletin_attachments` hoặc reuse `attachments` với owner_type='bulletin' (tên file, url) — ảnh bài đăng.
- `comments` reuse hoặc `bulletin_comments` (target_type='bulletin', target_id, author_id, content, mentioned_user_ids). Đơn giản: tạo `bulletin_comments` riêng cho rõ.
- RLS: select cho authenticated, insert/update/delete posts chỉ quan_ly_cai_dat / quan_ly_nguoi_dung (Admin). Comments: authenticated insert nếu đã xem.

## 4) Bảng tin — Trang
- Route `/bang-tin` (hoặc `/bulletin`). List bài mới nhất trước, phân trang 20, có ảnh, hiện tag @ như link tới hồ sơ.
- Nút "Đăng bài" chỉ hiện khi có quyền. Dialog: tiêu đề, nội dung (GrowArea), SingleCombobox chọn người để tag @ (gõ rồi mới search), AttachmentInput chọn ảnh.
- Detail: xem bài + danh sách bình luận + ô bình luận có tag @ (SingleCombobox multi). Bấm tag thì nhảy tới hồ sơ user.

## 5) Bot — Logic
- Route `GET /api/bot/weekly-check` (cron) + `POST /api/bot/weekly-check` (Admin chạy tay từ Cài đặt chung để test). Cần service_role + check cron secret hoặc quan_ly_cai_dat.
- Đọc 7 BOT_CHECK_* từ settings. Với mỗi việc được bật: query DB để tìm danh sách user chưa làm (vd OKR: profiles ACTIVE left join okrs where tu_ngay/den_ngay trong kỳ hiện tại). Gom lại.
- Tạo 1 `bulletin_posts` với title "Nhắc việc tuần …", content liệt kê từng nhóm, mentioned_user_ids = union các user bị nhắc (để @ đúng người). Nếu không ai chưa làm → vẫn tạo bài "Tuần này mọi người đã hoàn thành đủ." hoặc bỏ qua (chọn bỏ qua cho đỡ spam).
- Cron: `vercel.json` { "crons": [{ "path": "/api/bot/weekly-check", "schedule": "30 8 * * 1" }] } — Vercel tự gọi.

## 6) Cài đặt chung — 7 ô tích
- Card "Bot nhắc việc 8h30 thứ 2" với 7 checkbox (đọc/ghi 7 BOT_CHECK_*). Nút Lưu cài đặt chung đã có.

## 7) Không làm trong mảnh này
- Không tự động gửi Telegram/Email (chỉ đăng bảng tin).
- Không auto-fix dữ liệu.
- Không thêm việc mới ngoài 7 việc trên (sau này thêm thì thêm key + query).

## 8) An toàn & quyền
- Bảng tin posts/comments: RLS authenticated read, chỉ Admin write.
- Bot route: service_role hoặc quan_ly_cai_dat.

## 9) Tiêu chí xong
- Admin đăng bài có ảnh + tag @ được, nhân viên chỉ xem + bình luận + được tag.
- 7 ô tích trong Cài đặt chung lưu được, bot đọc đúng.
- Đến giờ cron bot tạo 1 bài bảng tin (test bằng POST chạy tay).
- Build xanh, push Vercel.
