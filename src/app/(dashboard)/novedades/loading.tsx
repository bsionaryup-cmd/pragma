import { ModuleShellFlow } from "@/components/layout/module-shell";

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border border-l-[3px] border-l-muted bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-4 w-12 rounded bg-muted" />
      </div>
      <div className="mt-2 h-4 w-40 rounded bg-muted" />
      <div className="mt-2 h-3 w-56 rounded bg-muted" />
      <div className="mt-2 h-8 w-full rounded bg-muted/70" />
      <div className="mt-3 h-8 w-24 rounded bg-muted" />
    </div>
  );
}

export default function NovedadesLoading() {
  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 pb-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full max-w-xl rounded bg-muted" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </ModuleShellFlow>
  );
}
