export default function Loading() {
  return (
    <div className="container-page py-6 sm:py-10" aria-busy="true">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="card mb-6 h-28 animate-pulse bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card h-40 animate-pulse bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
