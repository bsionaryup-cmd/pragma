import {
  OwnerDashboardKpiSkeleton,
  OwnerDashboardTableSkeleton,
  Skeleton,
} from "@/components/owner/owner-dashboard-skeletons";

export default function OwnerDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-16 sm:px-6">
      <div className="mb-8">
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mb-8">
        <OwnerDashboardKpiSkeleton />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-10 sm:col-span-2" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              <OwnerDashboardTableSkeleton rows={10} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
