# Bulletin + Bot 8h30 Implementation Plan

> For: inline (no subagents) — per owner. Review code at the end.

Goal: Bảng tin (Admin đăng, tag @, ảnh) + Bot 8h30 thứ 2 quét 7 việc + 7 ô tích trong Cài đặt chung + Vercel Cron.

## Task 1: Migration — bulletin tables + BOT_CHECK seeds
Files: `supabase/migrations/0022_bulletin_bot.sql` (bulletin_posts, bulletin_comments, RLS, BOT_CHECK_* seeds).
Steps: Write SQL, apply checklist (manual SQL Editor like before if pooler fails), verify select.
Commit: `feat(bulletin): migration bulletin + BOT_CHECK seeds`

## Task 2: Component — MentionInput (tag @) for bulletin
Files: `src/components/MentionInput.tsx` (textarea + SingleCombobox for users, inserts @Tên, tracks mentioned_user_ids).
Test: manual in bulletin dialog.
Commit: `feat(bulletin): MentionInput tag @`

## Task 3: Page — /bang-tin (list + detail)
Files: `src/app/bang-tin/page.tsx`, `src/app/bang-tin/[id]/page.tsx`
- List 20, detail with comments, only quan_ly_cai_dat sees "Đăng bài".
- Reuse attachments SingleCombobox pattern (import rồi mới search).
Commit: `feat(bulletin): bang-tin list + detail`

## Task 4: Cài đặt chung — 7 ô tích BOT
Files: `src/app/quan-tri/cai-dat/page.tsx` (add 7 checkboxes BOT_CHECK_*, save/load via settings).
Commit: `feat(bot): 7 o tich BOT_CHECK_* trong cai-dat`

## Task 5: API — /api/bot/weekly-check (GET cron + POST manual)
Files: `src/app/api/bot/weekly-check/route.ts` (service_role, reads 7 settings, 7 queries, creates 1 bulletin_posts + attachments not needed, mentions union).
- GET: cron auth (Bearer CRON_SECRET or Vercel header) + service_role check.
- POST: requires quan_ly_cai_dat.
Commit: `feat(bot): /api/bot/weekly-check`

## Task 6: Cron — vercel.json
Files: `vercel.json` — crons: [{ path: "/api/bot/weekly-check", schedule: "30 8 * * 1" }]
Commit: `chore: vercel cron 8h30 T2`

## Task 7: Sidebar link — Bảng tin
Files: `src/components/AppSidebar.tsx` — add { href: '/bang-tin', label: 'Bảng tin', needs: undefined or ['xem_okr']? } — make visible to all authenticated (no needs).
Commit: `feat(bulletin): sidebar link Bang tin`

## Task 8: Build + review
- `npm run build` must pass, `npm run test` if any.
- `superpowers:requesting-code-review` for correctness + simplifications.
- Push.
