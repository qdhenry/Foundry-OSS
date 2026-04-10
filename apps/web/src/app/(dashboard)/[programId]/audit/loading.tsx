export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-surface-raised" />
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
