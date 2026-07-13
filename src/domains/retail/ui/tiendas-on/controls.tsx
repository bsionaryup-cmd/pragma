import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function TiendasOnSearch({
  placeholder = "Buscar",
  className,
  name = "q",
  defaultValue,
}: {
  placeholder?: string;
  className?: string;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
      <input
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-[#c5ced8] bg-white pl-9 pr-3 text-sm text-[#2d3748] outline-none focus:border-pragma-electric focus:ring-1 focus:ring-pragma-electric/30"
      />
    </div>
  );
}

export function TiendasOnPrimaryButton({
  children,
  className,
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-pragma-electric px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-pragma-electric/90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TiendasOnActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 bg-white px-4 py-3", className)}>
      {children}
    </div>
  );
}
