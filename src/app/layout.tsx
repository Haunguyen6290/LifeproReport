import type { Metadata } from "next";
import "./globals.css";
import { TabTitle } from "@/components/TabTitle";

export const metadata: Metadata = {
  title: "Lifepro Report",
  description: "Hệ thống quản trị kinh doanh nội bộ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans"><TabTitle />{children}</body>
    </html>
  );
}
