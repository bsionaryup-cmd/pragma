import {
  CALENDAR_ROW_HEIGHT,
  CALENDAR_SIDEBAR_WIDTH,
  CALENDAR_TOOLBAR_HEIGHT,
} from "@/features/calendar/constants";

export default function CalendarLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="animate-pulse border-b border-border bg-muted/40"
          style={{ height: CALENDAR_TOOLBAR_HEIGHT }}
        />
        <div className="flex min-h-0 flex-1">
          <div
            className="animate-pulse border-r border-border bg-muted/30"
            style={{ width: CALENDAR_SIDEBAR_WIDTH }}
          />
          <div className="flex flex-1 flex-col gap-px p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded bg-muted/40"
                style={{ height: CALENDAR_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>
  );
}
