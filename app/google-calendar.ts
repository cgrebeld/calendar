import { defaultScheduleRange, type ScheduleRange } from "./schedule.ts";

export type CalendarEvent = {
  day: number;
  person: string;
  tone: "alex" | "sam" | "maya" | "family" | "collection";
  start: number;
  duration: number;
  title: string;
  detail: string;
  timeLabel?: string;
  allDay?: boolean;
  collection?: "garbage" | "recycling";
};

export function layoutEvents(events: CalendarEvent[], minimumDuration = 1, range: ScheduleRange = defaultScheduleRange) {
  const sorted = [...events].sort((left, right) => left.start - right.start || right.duration - left.duration || left.title.localeCompare(right.title));
  const place = (heightLimit = Infinity) => {
    let nextStart = range.startHour;
    return sorted.map((event) => {
      const start = Math.max(event.start, nextStart);
      const duration = Math.min(Math.max(event.duration, minimumDuration), heightLimit);
      nextStart = start + duration;
      return { event, start, duration };
    });
  };

  const natural = place();
  if (!natural.length || natural.at(-1)!.start + natural.at(-1)!.duration <= range.endHour) return natural;

  let low = 0;
  let high = Math.max(...natural.map(({ duration }) => duration));
  for (let iteration = 0; iteration < 20; iteration++) {
    const middle = (low + high) / 2;
    const result = place(middle);
    if (result.at(-1)!.start + result.at(-1)!.duration <= range.endHour) low = middle;
    else high = middle;
  }
  return place(low);
}

export type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

type Calendar = { id: string; summary: string; selected?: boolean; primary?: boolean };
const tones: CalendarEvent["tone"][] = ["alex", "sam", "maya", "family"];

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayDifference(date: Date, today: Date) {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

export function convertGoogleEvent(event: GoogleEvent, calendar: Calendar, tone: CalendarEvent["tone"], today: Date, range: ScheduleRange = defaultScheduleRange): CalendarEvent {
  const allDay = Boolean(event.start.date);
  const startDate = allDay ? localDate(event.start.date!) : new Date(event.start.dateTime!);
  const endDate = allDay ? startDate : new Date(event.end.dateTime!);
  const actualStart = startDate.getHours() + startDate.getMinutes() / 60;
  const start = Math.max(range.startHour, Math.min(range.endHour - 0.5, actualStart));
  return {
    day: dayDifference(startDate, today),
    person: calendar.summary,
    tone,
    start,
    duration: allDay ? 1 : Math.max(.5, Math.min(range.endHour - start, (endDate.getTime() - startDate.getTime()) / 3600000)),
    title: event.summary || "Untitled event",
    detail: [event.location, event.description].filter(Boolean).join(" · ") || calendar.summary,
    timeLabel: allDay ? "All day" : startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    allDay,
  };
}

export async function loadGoogleEvents(from: Date, to: Date, today: Date, range: ScheduleRange = defaultScheduleRange, force = false) {
  const query = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString() });
  if (force) query.set("force", "true");
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/calendar/events?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Calendar API returned ${response.status}`);
  return (data as { event: GoogleEvent; calendar: Calendar; tone: number }[]).map(({ event, calendar, tone }) => convertGoogleEvent(event, calendar, tones[tone % tones.length], today, range));
}
