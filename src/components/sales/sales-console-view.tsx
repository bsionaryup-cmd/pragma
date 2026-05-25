"use client";

import { useState } from "react";
import Link from "next/link";
import { QuoteCalculatorPanel } from "@/components/sales/quote-calculator-panel";
import { DiscountCodesPanel } from "@/components/sales/discount-codes-panel";
import { QuoteHistoryPanel } from "@/components/sales/quote-history-panel";
import { cn } from "@/lib/utils";

type Tab = "quotes" | "discounts" | "history";

export function SalesConsoleView({
  initialQuotes,
  initialCodes,
}: {
  initialQuotes: Parameters<typeof QuoteHistoryPanel>[0]["quotes"];
  initialCodes: Parameters<typeof DiscountCodesPanel>[0]["initialCodes"];
}) {
  const [tab, setTab] = useState<Tab>("quotes");

  const tabs: { id: Tab; label: string }[] = [
    { id: "quotes", label: "Custom Quotes" },
    { id: "discounts", label: "Discount Codes" },
    { id: "history", label: "History & Audit" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          PRAGMA Operations
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Sales Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cotizaciones SaaS · separado de Payment Links de huéspedes
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/owner-dashboard" className="text-pragma-electric hover:underline">
            ← Owner Dashboard
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/owner-dashboard/support"
            className="text-muted-foreground hover:text-foreground"
          >
            Support Center
          </Link>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-pragma-electric/15 text-pragma-electric"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "quotes" ? <QuoteCalculatorPanel /> : null}
      {tab === "discounts" ? (
        <DiscountCodesPanel initialCodes={initialCodes} />
      ) : null}
      {tab === "history" ? <QuoteHistoryPanel quotes={initialQuotes} /> : null}
    </div>
  );
}
