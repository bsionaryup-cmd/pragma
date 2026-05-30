"use client";

import {
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Bell,
  MessageCircle,
  LineChart,
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
  "line-chart": LineChart,
  "key-round": KeyRound,
  "list-checks": ListChecks,
  bell: Bell,
  "credit-card": CreditCard,
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
