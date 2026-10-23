import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-5xl" aria-hidden>🧺</p>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-neutral-600">This item or page is no longer available.</p>
      <Link href="/" className="btn-primary">Go to the shop</Link>
    </main>
  );
}
