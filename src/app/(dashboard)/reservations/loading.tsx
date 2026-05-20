export default function ReservationsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-12 animate-pulse border-b border-border bg-muted/40" />
        <div className="flex-1 space-y-px">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse bg-muted/30" />
          ))}
        </div>
      </div>
  );
}
