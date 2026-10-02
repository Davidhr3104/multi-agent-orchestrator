/** Shown while a page's desk data loads, so navigation never looks frozen. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="skeleton h-80 lg:col-span-3" />
        <div className="skeleton h-80 lg:col-span-2" />
      </div>
    </div>
  );
}
