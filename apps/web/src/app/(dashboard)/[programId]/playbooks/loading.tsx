export default function PlaybooksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-surface-raised" />
          <div className="mt-2 h-4 w-24 animate-pulse rounded bg-surface-raised" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-surface-raised" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
