/** Friendly "couldn't load" block for storefront pages, with a retry button. */
export function ErrorState({ title = "Couldn't load this", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white px-6 py-10 text-center ring-1 ring-line" role="alert">
      <p className="font-display text-[22px] font-bold">{title}</p>
      <p className="mt-1 text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-brand mt-6 px-8">
          Try again
        </button>
      )}
    </div>
  );
}
