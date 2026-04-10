export default function SprintsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-raised" />
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 w-40 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
