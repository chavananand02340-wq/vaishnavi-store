import { getSettings } from "@/lib/store-data";
import { CartProvider } from "@/components/store/cart";
import { CartBar } from "@/components/store/CartBar";
import { BottomNav } from "@/components/store/BottomNav";
import { StoreFooter } from "@/components/store/StoreFooter";
import { ToastProvider } from "@/components/Toast";

// Store pages are cached and refreshed at most every 15 minutes,
// and immediately when the owner changes products or settings.
export const revalidate = 900;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <ToastProvider>
      <CartProvider settings={settings}>
        <div className="flex min-h-dvh flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
          <StoreFooter />
        </div>
        <CartBar />
        <BottomNav />
      </CartProvider>
    </ToastProvider>
  );
}
