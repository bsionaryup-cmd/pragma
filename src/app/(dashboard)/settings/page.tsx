import { Topbar } from "@/components/layout/topbar";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Ajustes" description="Configuración de tu cuenta y espacio" />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Ajustes</h2>
        <p className="max-w-md text-sm text-[#6b6b6b]">
          Este módulo se conectará próximamente.
        </p>
      </main>
    </>
  );
}
