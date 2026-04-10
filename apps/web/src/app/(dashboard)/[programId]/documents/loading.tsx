export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-raised" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-raised" />
      </div>
      <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-raised" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
