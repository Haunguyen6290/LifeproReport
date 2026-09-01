'use client';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { KeHoachPanel } from '@/components/KeHoachPanel';

function Screen() {
  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Kế hoạch bán hàng</h1>
          <p className="mt-1 text-sm text-slate-600">
            Chọn tháng, sau đó gán miền và kế hoạch doanh số / thu tiền cho từng kinh doanh. Số liệu dùng trong báo cáo <b>Bán hàng thu tiền</b>.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <KeHoachPanel embed="page" />
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
