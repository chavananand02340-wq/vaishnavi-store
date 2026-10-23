"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-neutral-600">Please check your internet connection and try again.</p>
      <button type="button" className="btn-primary" onClick={() => reset()}>Try again</button>
    </main>
  );
}
