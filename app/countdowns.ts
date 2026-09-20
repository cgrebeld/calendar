import { dayDifference, type GoogleEvent } from "./google-calendar.ts";

export function countdownRange(today: Date) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = new Date(today.getFullYear(), today.getMonth() + 6, 1);
  const lastDay = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  to.setDate(Math.min(today.getDate(), lastDay));
  return { from, to };
}

export function countdownItems(entries: { event: GoogleEvent; calendar: { id: string } }[], today: Date) {
  const { from, to } = countdownRange(today);
  return entries.flatMap(({ event, calendar }) => {
    const date = new Date(event.start.date ? `${event.start.date}T00:00:00` : event.start.dateTime!);
    if (!Number.isFinite(date.getTime()) || date < from || date >= to) return [];
    const days = dayDifference(date, today);
    const title = (event.summary || "Untitled event").replace(/(^|\s)#countdown(?=\s|$|[.,;:!?])/gi, "$1").trim() || "Untitled event";
    return [{ id: `${calendar.id}:${event.id}:${date.toISOString()}`, date, title: `${days} ${days === 1 ? "day" : "days"} until ${title}` }];
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}
