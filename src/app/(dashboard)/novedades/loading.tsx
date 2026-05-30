import { ModuleShellFlow } from "@/components/layout/module-shell";

export default function NovedadesLoading() {
  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </ModuleShellFlow>
  );
}
