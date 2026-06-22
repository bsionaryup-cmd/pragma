"use client";

import Link from "next/link";
import { findMockResearch } from "@/features/sales-console/data/mock-research";
import { MOCK_PROSPECTS } from "@/features/sales-console/data/mock-prospects";
import {
  formatProspectSegment,
  formatProspectSource,
  getIcpTier,
  getIcpTierLabel,
} from "@/features/sales-console/types/prospect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type ResearchMockViewProps = {
  prospectId: string | null;
};

export function ResearchMockView({ prospectId }: ResearchMockViewProps) {
  const prospect = prospectId
    ? MOCK_PROSPECTS.find((row) => row.id === prospectId)
    : undefined;
  const research = prospectId ? findMockResearch(prospectId) : undefined;

  if (!prospectId) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Select a prospect to view research</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a company from Prospects or Pipeline to preview mock research.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/owner-dashboard/sales/prospects">Go to Prospects</Link>
        </Button>
      </div>
    );
  }

  if (!prospect || !research) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          {prospect?.companyName ?? "Prospect"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No mock research profile yet for this prospect.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-4" disabled>
          Research AI — coming soon
        </Button>
      </div>
    );
  }

  const tier = getIcpTier(prospect.score);

  return (
    <div className="mt-4 space-y-4">
      <SectionCard title={research.companyName}>
        <div className="space-y-5 px-4 pb-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatProspectSegment(research.segment)}</Badge>
            <Badge variant="outline">{formatProspectSource(prospect.source)}</Badge>
            {tier ? (
              <Badge className="border-0 bg-pragma-caramel/15 text-pragma-caramel">
                ICP {getIcpTierLabel(tier)}
              </Badge>
            ) : null}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Segment
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {formatProspectSegment(research.segment)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estimated properties
              </dt>
              <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">
                {research.estimatedProperties}
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current stack
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {research.currentStack.map((tool) => (
                <Badge key={tool} variant="secondary">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pain points
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
              {research.painPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-pragma-electric/20 bg-pragma-electric/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-pragma-electric">
              Recommended positioning
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {research.recommendedPositioning}
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" disabled>
            Research AI — coming soon
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
