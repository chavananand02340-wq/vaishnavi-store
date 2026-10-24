import { getSettings } from "@/lib/store-data";
import { CartProvider } from "@/components/store/cart";
import { CartBar } from "@/components/store/CartBar";
import { StoreFooter } from "@/components/store/StoreFooter";
import { ToastProvider } from "@/components/Toast";

// Store pages are cached on the CDN and refreshed at most every 60 s,
// and immediately when the owner changes products or settings.
export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <ToastProvider>
      <CartProvider settings={settings}>
        <div className="flex min-h-dvh flex-col">
          {children}
          <StoreFooter />
        </div>
        <CartBar />
      </CartProvider>
    </ToastProvider>
  );
}
