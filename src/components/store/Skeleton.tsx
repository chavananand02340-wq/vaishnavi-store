/** Grey shimmering placeholders shown while products load. */
export function CardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] bg-white p-2 ring-1 ring-line" aria-hidden>
      <div className="skeleton aspect-square rounded-[10px]" />
      <div className="skeleton mt-2.5 h-3.5 w-4/5 rounded" />
      <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
      <div className="mt-3 flex items-end justify-between">
        <div className="skeleton h-4 w-12 rounded" />
        <div className="skeleton h-9 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
