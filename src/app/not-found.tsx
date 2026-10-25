import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="font-display text-[56px] font-extrabold text-brand-700" aria-hidden>404</p>
      <h1 className="font-display text-[24px] font-bold">Page not found</h1>
      <p className="text-sm text-muted">This item or page is no longer available.</p>
      <Link href="/" className="btn-brand">Go to the shop</Link>
    </main>
  );
}
