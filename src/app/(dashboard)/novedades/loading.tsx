import { ModuleShellFlow } from "@/components/layout/module-shell";

export default function NovedadesLoading() {
  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 pb-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full max-w-xl rounded bg-muted" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card px-4 py-3 shadow-pragma-soft"
            >
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="mt-2 h-3 w-56 rounded bg-muted" />
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="h-8 w-full rounded bg-muted/70" />
                <div className="h-8 w-full rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModuleShellFlow>
  );
}
