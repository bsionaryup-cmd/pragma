import { ModuleShellFill } from "@/components/layout/module-shell";

export default function NovedadesLoading() {
  return (
    <ModuleShellFill className="bg-muted/10">
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <aside className="flex h-full w-full max-w-[400px] shrink-0 flex-col border-r border-border bg-background">
          <div className="space-y-3 border-b border-border px-3 py-3">
            <div className="h-5 w-28 rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
          </div>
          <div>
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="border-b border-border/70 px-3 py-3"
              >
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted/80" />
                    <div className="h-3 w-4/5 rounded bg-muted/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="hidden min-w-0 flex-1 flex-col bg-muted/10 p-6 md:flex">
          <div className="mx-auto w-full max-w-3xl">
            <div className="h-10 w-64 rounded bg-muted" />
            <div className="mt-8 space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-3">
                  <div className="mx-auto h-3 w-40 rounded bg-muted/70" />
                  <div className="h-16 w-full rounded-md border border-border/60 bg-background" />
                  <div className="h-16 w-full rounded-md border border-border/60 bg-background" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleShellFill>
  );
}
