export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card card-pad animate-pulse">
            <div className="h-3 w-20 rounded bg-ink-850" />
            <div className="mt-3 h-6 w-28 rounded bg-ink-850" />
          </div>
        ))}
      </div>
      <div className="card card-pad animate-pulse">
        <div className="h-3 w-32 rounded bg-ink-850" />
        <div className="mt-4 h-40 rounded-xl bg-ink-850" />
      </div>
      <div className="card card-pad animate-pulse space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 rounded bg-ink-850" />
        ))}
      </div>
    </div>
  );
}
