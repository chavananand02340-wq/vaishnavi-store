import type { Metadata, Viewport } from "next";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: site ? new URL(site) : undefined,
  icons: { apple: "/apple-touch-icon.png" },
  title: { default: "Vaishnavi Store", template: "%s · Vaishnavi Store" },
  description: "Groceries and daily essentials from Vaishnavi Store, delivered to your door.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6b3d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
