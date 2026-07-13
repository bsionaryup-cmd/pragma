import { cn } from "@/lib/utils";

export function TiendasOnTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto bg-white", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TiendasOnTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="bg-[#e8f4ff] text-left text-[13px] font-semibold text-[#2c5282]">
        {children}
      </tr>
    </thead>
  );
}

export function TiendasOnTh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}

export function TiendasOnTd({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      className={cn("border-t border-[#e2e8f0] px-4 py-3 text-[#4a5568]", className)}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

export function TiendasOnSummaryCard({
  title,
  accent,
  icon,
  children,
  action,
}: {
  title: string;
  accent: "amber" | "pragma" | "rose";
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const border =
    accent === "amber"
      ? "border-t-[#f6c453]"
      : accent === "rose"
        ? "border-t-[#e57373]"
        : "border-t-pragma-electric";

  return (
    <section
      className={cn(
        "flex min-h-[360px] flex-col rounded-md border border-[#d5dce6] border-t-4 bg-white shadow-sm",
        border,
      )}
    >
      <header className="flex items-center gap-2 border-b border-[#edf2f7] px-4 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-[#2d3748]">{title}</h3>
        <div className="ml-auto">{action}</div>
      </header>
      <div className="flex-1 space-y-2 px-4 py-3 text-sm">{children}</div>
    </section>
  );
}

export function TiendasOnSummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "strong-positive";
}) {
  const valueClass =
    tone === "positive"
      ? "text-pragma-electric"
      : tone === "negative"
        ? "text-red-600"
        : tone === "strong-positive"
          ? "text-base font-bold text-pragma-electric"
          : "text-[#2d3748]";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#718096]">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
