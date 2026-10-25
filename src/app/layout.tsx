import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Mukta } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

// Mukta covers Latin + Devanagari, so Marathi can be added later without a font change.
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-mukta",
  display: "swap",
});

const site = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: site ? new URL(site) : undefined,
  icons: { apple: "/apple-touch-icon.png" },
  title: { default: "Vaishnavi E-Mart", template: "%s | Vaishnavi E-Mart" },
  description: "Groceries and daily essentials from Vaishnavi Store, delivered to your door in about 30 minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e30613",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${mukta.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
