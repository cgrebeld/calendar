export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export type ViewMode = "day" | "week" | "twoWeek" | "month";

export const DAY_VIEW_STEP = 1;

export function swipeDirection(deltaX: number, deltaY: number): -1 | 0 | 1 {
  return Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX < 0 ? 1 : -1) : 0;
}

export function viewDates(anchor: Date, mode: ViewMode) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (mode === "day") return [addDays(start, -1), start, addDays(start, 1)];
  if (mode === "month") start.setDate(1);
  start.setDate(start.getDate() - start.getDay());
  const count = mode === "week" ? 7 : mode === "twoWeek" ? 14 : 42;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function moveAnchor(anchor: Date, mode: ViewMode, direction: -1 | 1) {
  if (mode === "month") {
    const result = new Date(anchor);
    result.setMonth(result.getMonth() + direction);
    return result;
  }
  return addDays(anchor, direction * ({ day: DAY_VIEW_STEP, week: 7, twoWeek: 14 }[mode]));
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const shortMonthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

export function viewTitle(dates: Date[], mode: ViewMode, anchor: Date) {
  if (mode === "month") return monthTitle.format(anchor);
  if (mode === "day") {
    const first = dates[0];
    const last = dates.at(-1)!;
    if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) return monthTitle.format(anchor);
    if (first.getFullYear() === last.getFullYear()) return `${shortMonth.format(first)} – ${shortMonth.format(last)} ${last.getFullYear()}`;
    return `${shortMonthYear.format(first)} – ${shortMonthYear.format(last)}`;
  }
  if (dates.length === 1) return shortDate.format(dates[0]);
  return `${shortDate.format(dates[0])} – ${shortDate.format(dates.at(-1)!)}`;
}
