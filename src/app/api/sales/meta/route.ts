import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Meta nhẹ: chỉ lấy danh sách tháng (sale_month) + năm để chọn kỳ mặc định.
// KHÔNG quét hết cột nữa — các filter (NV/Tỉnh/Nhóm/SP/KH) sẽ lấy từ kết quả sales_report sau khi Chạy.
export async function GET() {
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ưu tiên hàm SQL nhẹ (chạy trên index, trả vài chục giá trị). Chưa có migration 0039 thì fallback quét bảng.
    try {
      const { data, error } = await admin.rpc('sales_months');
      if (!error && data) {
        const months = Array.isArray((data as any).months) ? (data as any).months : [];
        const years = Array.isArray((data as any).years) ? (data as any).years : [];
        return NextResponse.json({ months, years });
      }
      if (error && String((error as any).code) !== 'PGRST202' && String((error as any).code) !== '42883') throw error;
    } catch { /* fallback bên dưới */ }

    const step = 1000;
    let offset = 0;
    const months = new Set<string>();
    let scanned = 0;
    while (true) {
      const { data, error } = await (admin.from('sales_rows').select('sale_month') as any).range(offset, offset + step - 1);
      if (error) {
        if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') {
          return NextResponse.json({ months: [], years: [] });
        }
        throw error;
      }
      const chunk = (data ?? []) as { sale_month: string }[];
      if (chunk.length === 0) break;
      scanned += chunk.length;
      for (const r of chunk) if (r.sale_month) months.add(r.sale_month);
      if (chunk.length < step) break;
      offset += step;
      if (scanned > 500000) break; // safety cap
    }
    const sortedMonths = [...months].sort().reverse();
    const years = [...new Set(sortedMonths.map((m) => m.slice(0, 4)))].sort().reverse();
    return NextResponse.json({ months: sortedMonths, years });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi meta' }, { status: 500 });
  }
}
