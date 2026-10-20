# Đặc tả — Bộ lọc Báo cáo bán hàng

> **Nguồn:** `src/app/bao-cao-ban-hang/page.tsx` — component `FilterDropdown` (dòng 402) và `ExcelFilter` (dòng 184)  
> **Mục đích:** Tài liệu để bên thứ ba tái tạo y hệt trên dự án khác (ngôn ngữ/framework nào cũng được, chỉ cần giữ đúng hành vi).

---

## 1. Tổng quan

- **Vị trí:** Trang **Báo cáo bán hàng** (`/bao-cao-ban-hang`), ngay dưới thanh chọn kỳ (Tháng / Quý / Năm / Tùy chọn) và trên 2 tab **Tổng quan / Chi tiết**.
- **Vai trò:** Bộ lọc phụ — không tự chạy báo cáo. Chỉ gom điều kiện để khi bấm **"Chạy báo cáo"** thì gửi kèm lên API.
- **API nhận:** `POST /api/sales/query` và `POST /api/sales/detail` (cùng payload filter + khoảng ngày).

---

## 2. Danh sách 5 ô lọc

| # | Nhãn | Key gửi API | Nguồn options | Có ô Tìm? |
|---|------|-------------|---------------|-----------|
| 1 | NV | `kd` | `result.options.kd` (sau khi Chạy) / `filterOpts.kd` (fallback) | Không |
| 2 | Tỉnh | `vung` | `options.vung` | Không |
| 3 | Nhóm hàng | `nhom` | `options.nhom` | Không |
| 4 | Sản phẩm | `sp` | `options.sp` — dạng `[MÃ] Tên`, đã bỏ phần `[MÃ]` lặp đầu | **Có** |
| 5 | Khách hàng | `kh` | `options.kh` — Tên KH | **Có** |

> **Lưu ý nguồn:** Options lấy từ **kết quả báo cáo vừa chạy** (`j.options` trả về từ `/api/sales/query`), không phải quét toàn bộ DB. Khi chưa chạy lần nào thì `options=[]` → ô lọc tự ẩn (`return null`).

---

## 3. Component `FilterDropdown` — hành vi chuẩn

### 3.1. Props

```ts
FilterDropdown({
  label: string;        // "NV", "Tỉnh", "Nhóm hàng", "Sản phẩm", "Khách hàng"
  options: string[];    // danh sách đầy đủ
  selected: string[];   // đang tick
  onChange: (v: string[]) => void;
  searchable?: boolean; // true → có ô Tìm ở đầu dropdown
})
```

### 3.2. Nút đóng/mở

- Dạng pill bo tròn, viền `border-[#e2e8f0]`, nền trắng.
- Tiêu đề: `label: Tất cả` khi `selected=[]`, `label: 1 mục` / `3 mục` khi đã chọn.
- Bấm lần nữa đóng. Bấm ra ngoài tự đóng (lắng `mousedown` trên `document`, check `ref.contains(target)`).
- Mũi tên `▼` xoay 180° khi mở (`transition`).

### 3.3. Dropdown

- Vị trí: `absolute left-0 mt-1` ngay dưới nút, rộng `w-64`, cao tối đa `max-h-64` có scroll, nền trắng, viền `border-slate-200`, bóng `shadow-lg`, bo `rounded-lg`, padding `p-2`.
- **Dòng đầu:** checkbox **"Tất cả"** — tick khi `selected.length === 0`. Bấm thì `onChange([])` = xóa lọc.
- **Nếu `searchable`:** có ô `input` "Tìm..." ở trên cùng (autoFocus). Gõ thì lọc `options.filter(o => o.toLowerCase().includes(q))`, tối đa 40–50 kết quả. Không có thì hiện thẳng tối đa 200 options.
- **Các dòng sau:** mỗi option 1 dòng `label > checkbox + tên (truncate, title đầy đủ)`. Tick → `onChange([...selected, o])`, bỏ tick → `onChange(selected.filter(x => x !== o))`. Hover `bg-slate-50`.
- **Không tìm thấy:** hiện `Không tìm thấy` (text `text-xs text-slate-600`).

### 3.4. Trạng thái

- `selected=[]` nghĩa là **không lọc** (hiện tất cả). Không lưu trạng thái "chọn hết".
- `options=[]` → component trả `null` (ẩn luôn ô đó).

### 3.5. Mã tham khảo (rút gọn)

```tsx
function FilterDropdown({ label, options, selected, onChange, searchable }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (options.length === 0) return null;
  const filtered = searchable && q.trim()
    ? options.filter(o => String(o).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
    : options.filter(o => o != null && String(o).trim() !== '').slice(0, searchable ? 50 : 200);
  const labelText = selected.length === 0 ? 'Tất cả'
    : selected.length === 1 ? selected[0] : `${selected.length} mục`;
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  // ... render nút + dropdown như mô tả trên
}
```

---

## 4. Component `ExcelFilter` — bản nâng cao (dùng trong bảng Khách hàng × Tháng)

Giống `FilterDropdown` nhưng thêm:

- Nút **Chọn hết / Bỏ hết** — `onChange(allChecked ? [] : options.slice())`.
- Nút **Không lọc** riêng — `onChange([])`.
- Nút **Xong** để đóng.
- Logic "tick đủ hết thì tự về `[]`" để không lưu thừa: `onChange(next.length === options.length ? [] : next)`.
- Hiển thị trạng thái viền xanh `border-[#16A97B] bg-[#ecfdf5]` khi đang lọc.

Vị trí: `src/app/bao-cao-ban-hang/page.tsx:184`.

---

## 5. Cách gửi lên API

Khi bấm **Chạy báo cáo**, hàm `buildFilters()` gom và gửi:

```js
function buildFilters() {
  const body = {};
  if (selKd.length) body.kd = selKd;
  if (selVung.length) body.vung = selVung;
  if (selNhom.length) body.nhom = selNhom;
  if (selKh.length) body.kh = selKh;
  if (selSp.length) body.sp = selSp;
  return body;
}

// Chạy báo cáo
const body = { ...buildFilters(), from: fromDate, to: toDate };
fetch('/api/sales/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

// Tab Chi tiết gửi thêm
fetch('/api/sales/detail', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ ...buildFilters(), from, to, page, limit: 20, search, ma_kh_norm: [...] }),
});
```

- Mảng rỗng → bỏ key hoặc gửi `null` — server hiểu là **không lọc**.
- Server (`/api/sales/query` → RPC `sales_report`) nhận `p_kd`, `p_vung`, `p_nhom`, `p_kh`, `p_sp` và `WHERE ... IN (...)` tương ứng.
- Tab **Chi tiết** gửi thêm `ma_kh_norm` (mã chuẩn hóa) và `search` (tìm trong bảng).

> **Auth:** Đợt 1 đã siết — tất cả 5 API sales đều check `Authorization: Bearer <token>` với quyền `bao_cao_ban_hang` / `xem_tai_chinh` / `quan_ly_cai_dat`. Frontend lấy token qua `supabase.auth.getSession()`.

---

## 6. Luồng người dùng

```
1. Mở /bao-cao-ban-hang → tự chọn kỳ mới nhất (từ /api/sales/meta) → tự Chạy → có result
2. 5 ô lọc hiện theo result.options (ô nào không có options thì ẩn)
3. Tick chọn trong dropdown (multi-select) → selected[] thay đổi
4. Bấm "Chạy báo cáo" → buildFilters() + from/to → POST /api/sales/query → result + options mới
5. Tab Chi tiết cũng dùng cùng filter + thêm search + phân trang
```

---

## 7. Checklist để bên kia làm lại

- [ ] 5 ô multi-select, 2 ô có search (Sản phẩm, Khách hàng).
- [ ] Click ngoài đóng, tối đa 40–50 kết quả khi search.
- [ ] "Tất cả" = mảng rỗng `[]`, không phải mảng đủ.
- [ ] Options lấy từ **kết quả báo cáo vừa chạy**, không phải từ DB toàn bộ.
- [ ] Khi đổi kỳ + bấm Chạy thì mới fetch lại options.
- [ ] Gửi `Authorization: Bearer <token>` nếu API có check quyền.
- [ ] Style: pill bo tròn, dropdown `w-64 max-h-64`, checkbox + truncate.

---

## 8. File tham chiếu trong repo

- `src/app/bao-cao-ban-hang/page.tsx` — `FilterDropdown` (402), `ExcelFilter` (184), `buildFilters` (594), `runQuery` (604), `loadDetail` (633), `fetchMeta` (562)
- `src/app/api/sales/query/route.ts` — nhận `kd/vung/nhom/kh/sp`, gọi `sales_report` RPC
- `src/app/api/sales/detail/route.ts` — nhận thêm `search`, `ma_kh_norm`
- `src/app/api/sales/meta/route.ts` — trả `months/years` cho kỳ mặc định
