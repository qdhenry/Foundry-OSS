export default function ProgramLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}
