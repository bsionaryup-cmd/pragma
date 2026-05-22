import { PragmaLoader } from "@/components/brand/pragma-loader";

export default function IntegrationsLoading() {
  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center">
      <PragmaLoader size="lg" />
    </div>
  );
}
