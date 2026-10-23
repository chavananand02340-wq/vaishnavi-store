export function Notice({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error)
    return (
      <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
        {ok}
      </p>
    );
  return null;
}
