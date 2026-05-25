import type { CalendarDayMeta } from "@/features/calendar/types/calendar.types";
import { dateKeyToPrismaDate } from "@/lib/dates";

export type CalendarViewSettings = {
  showImage: boolean;
  showInternalName: boolean;
  showIdentificationNumber: boolean;
  showPrice: boolean;
  showMinimumStay: boolean;
  weekStartsOn: "monday" | "sunday";
};

export const DEFAULT_CALENDAR_VIEW_SETTINGS: CalendarViewSettings = {
  showImage: true,
  showInternalName: true,
  showIdentificationNumber: true,
  showPrice: true,
  showMinimumStay: true,
  weekStartsOn: "monday",
};

const STORAGE_KEY = "pragma-calendar-view-settings";

export function loadCalendarViewSettings(): CalendarViewSettings {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_VIEW_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CALENDAR_VIEW_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CalendarViewSettings>;
    return {
      ...DEFAULT_CALENDAR_VIEW_SETTINGS,
      ...parsed,
      weekStartsOn:
        parsed.weekStartsOn === "sunday" ? "sunday" : "monday",
    };
  } catch {
    return DEFAULT_CALENDAR_VIEW_SETTINGS;
  }
}

export function saveCalendarViewSettings(settings: CalendarViewSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyWeekStartsOnToDays(
  days: CalendarDayMeta[],
  weekStartsOn: CalendarViewSettings["weekStartsOn"],
): CalendarDayMeta[] {
  return days.map((day) => {
    const utcDay = dateKeyToPrismaDate(day.date).getUTCDay();
    const isWeekend =
      weekStartsOn === "monday"
        ? utcDay === 0 || utcDay === 6
        : utcDay === 0;
    return { ...day, isWeekend };
  });
}
