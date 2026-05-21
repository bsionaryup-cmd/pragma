"use client";

import {
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Ribbon,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/navigation";

const ICONS: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "clipboard-list": ClipboardList,
  "message-circle": MessageCircle,
  "calendar-days": CalendarDays,
  "building-2": Building2,
  ribbon: Ribbon,
  wallet: Wallet,
  settings: Settings,
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={1.75} />;
}
