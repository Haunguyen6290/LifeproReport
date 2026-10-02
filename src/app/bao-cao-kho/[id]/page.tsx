'use client';
import { use } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { WarehouseReportDetail } from '@/components/WarehouseReportDetail';

// Trang riêng của 1 phiếu kho — dùng chung nội dung với hộp "Chi tiết báo cáo kho" ở trang danh sách
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <AppSidebar>
        <main className="w-full px-4 py-6 sm:px-6">
          <a href="/bao-cao-kho" className="mb-3 inline-block text-sm font-semibold text-[#1e3a8a] hover:underline">← Báo cáo kho</a>
          <WarehouseReportDetail id={id} />
        </main>
      </AppSidebar>
    </RequireAuth>
  );
}
