import type { Metadata } from "next";
import { TeamProvider } from "@/components/admin/team";
import { Shell } from "@/components/admin/Shell";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = { title: "Live orders", robots: { index: false, follow: false } };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TeamProvider need="any">
        <Shell>{children}</Shell>
      </TeamProvider>
    </ToastProvider>
  );
}
