export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-24 animate-pulse rounded bg-surface-raised" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-surface-raised" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-raised" />
      </div>
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="space-y-3">
            <div className="h-10 animate-pulse rounded-lg bg-surface-raised" />
            {[1, 2].map((card) => (
              <div key={card} className="h-32 animate-pulse rounded-xl bg-surface-raised" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
