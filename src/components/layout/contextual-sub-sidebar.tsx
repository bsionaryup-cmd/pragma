"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { getActiveNavChild, type NavGroupModule } from "@/lib/navigation";
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
  const open = module !== null;
  const activeChild = module
    ? getActiveNavChild(pathname, module.children)
    : null;

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar/95 transition-[width,opacity] duration-200 ease-in-out",
        open ? "w-[212px] opacity-100" : "w-0 opacity-0",
      )}
    >
      {module ? (
        <div className="flex h-full w-[212px] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/80 px-3 py-3">
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-pragma-mid-gray dark:text-muted-foreground">
              {t(module.labelKey)}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar submenú"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-pragma-mid-gray transition-colors hover:bg-pragma-soft-gray hover:text-pragma-black"
            >
              <ChevronsLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <nav
            className="pragma-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-3"
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
                  prefetch={false}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-pragma-soft-cyan/45 text-pragma-electric dark:bg-primary/10"
                      : "text-pragma-mid-gray hover:bg-white/80 hover:text-pragma-black dark:text-muted-foreground dark:hover:bg-sidebar-accent dark:hover:text-foreground",
                  )}
                >
                  {t(child.labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </aside>
  );
}
