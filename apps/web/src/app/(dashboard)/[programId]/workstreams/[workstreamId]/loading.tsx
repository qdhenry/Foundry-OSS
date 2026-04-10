export default function WorkstreamDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-surface-raised" />
          <div>
            <div className="h-8 w-56 animate-pulse rounded bg-surface-raised" />
            <div className="mt-2 flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-surface-raised" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-surface-raised" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-surface-raised" />
            </div>
          </div>
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-raised" />
      </div>

      {/* Tab bar skeleton */}
      <div className="border-b border-border-default">
        <div className="flex gap-6 pb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 w-20 animate-pulse rounded bg-surface-raised" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-40 animate-pulse rounded-xl bg-surface-raised" />
        </div>
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-xl bg-surface-raised" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-raised" />
          <div className="h-20 animate-pulse rounded-xl bg-surface-raised" />
        </div>
      </div>
    </div>
  );
}
