import type { Metadata } from "next";
import { TeamProvider } from "@/components/admin/team";
import { Shell } from "@/components/admin/Shell";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = { title: "Owner panel", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TeamProvider need="owner">
        <Shell>{children}</Shell>
      </TeamProvider>
    </ToastProvider>
  );
}
