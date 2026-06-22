import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CampaignsMockView() {
  return (
    <div className="mt-4 space-y-4">
      <EmptyState
        icon={Megaphone}
        branded={false}
        title="No campaigns yet"
        description="Campaign builder will live here. Mock-only in F1.5."
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prospects</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody />
        </Table>
      </div>
    </div>
  );
}
