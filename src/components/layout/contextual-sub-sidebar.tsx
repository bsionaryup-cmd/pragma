"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { getActiveNavChild, type NavGroupModule } from "@/lib/navigation";
import { SUB_SIDEBAR_WIDTH_CLASS } from "@/components/layout/nav-layout.constants";
import { cn } from "@/lib/utils";

type ContextualSubSidebarProps = {
  module: NavGroupModule | null;
  onClose: () => void;
  onNavigate?: () => void;
};

export function ContextualSubSidebar({
  module,
  onClose,
  onNavigate,
}: ContextualSubSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  if (!module?.children?.length) return null;

  const activeChild = getActiveNavChild(pathname, module.children);

  return (
    <aside
      className={cn(
        "grid shrink-0 grid-rows-[auto_minmax(0,1fr)] self-stretch overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
        SUB_SIDEBAR_WIDTH_CLASS,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/80 px-3 py-3">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t(module.labelKey)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar submenú"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronsLeft className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <nav
        className="pragma-scrollbar min-h-0 space-y-0.5 overflow-y-auto px-2 py-3"
        aria-label={t(module.labelKey)}
      >
        {module.children.map((child) => {
          const active =
            activeChild !== null &&
            activeChild.href === child.href &&
            activeChild.labelKey === child.labelKey;
          return (
            <Link
              key={`${child.href}-${child.labelKey}`}
              href={child.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-pragma-soft-cyan/45 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {t(child.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
