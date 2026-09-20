export type ScheduleRange = { startHour: number; endHour: number };

export const defaultScheduleRange: ScheduleRange = { startHour: 7, endHour: 22 };

export function parseHour(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return undefined;
  const hour = Number(match[1]) + Number(match[2] ?? 0) / 60;
  return hour >= 0 && hour <= 24 ? hour : undefined;
}

export function parseScheduleRange(start?: string, end?: string): ScheduleRange {
  const startHour = parseHour(start);
  const endHour = parseHour(end);
  if (startHour === undefined || endHour === undefined || endHour <= startHour) return defaultScheduleRange;
  return { startHour, endHour };
}

export function scheduleRangeFromEnv(): ScheduleRange {
  return parseScheduleRange(import.meta.env.VITE_SCHEDULE_START, import.meta.env.VITE_SCHEDULE_END);
}

export function scheduleHours(range: ScheduleRange): number {
  return range.endHour - range.startHour;
}

export function hourOffset(range: ScheduleRange, hour: number): number {
  return (hour - range.startHour) / scheduleHours(range);
}

export function hourLabels(range: ScheduleRange): number[] {
  const first = Math.ceil(range.startHour);
  const last = Math.floor(range.endHour);
  const step = scheduleHours(range) > 8 ? 2 : 1;
  const labels: number[] = [];
  for (let hour = first; hour <= last; hour += step) labels.push(hour);
  return labels;
}

export type LaidOut = { event: { start: number; duration: number }; start: number; duration: number };

export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function timeMarkerOffset(now: number, laidOut: LaidOut[], range: ScheduleRange): number | null {
  if (now < range.startHour || now > range.endHour) return null;
  const anchors: [number, number][] = [[range.startHour, range.startHour]];
  for (const { event, start, duration } of laidOut) {
    anchors.push([event.start, start], [event.start + event.duration, start + duration]);
  }
  anchors.push([range.endHour, range.endHour]);
  anchors.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const points = anchors.filter((anchor, index) => index === 0 || anchor[0] !== anchors[index - 1][0]);
  let laidOutHour = points.at(-1)![1];
  for (let index = 0; index < points.length; index++) {
    if (points[index][0] === now) {
      laidOutHour = points[index][1];
      break;
    }
    if (points[index][0] > now) {
      const [actualBefore, laidBefore] = points[index - 1];
      const [actualAfter, laidAfter] = points[index];
      laidOutHour = laidBefore + ((laidAfter - laidBefore) * (now - actualBefore)) / (actualAfter - actualBefore);
      break;
    }
  }
  return Math.min(1, Math.max(0, hourOffset(range, laidOutHour)));
}

export function placeRows(starts: number[], range: ScheduleRange, rowFraction: number): number[] {
  const tops: number[] = [];
  for (const start of starts) {
    const previous = tops.length ? tops.at(-1)! + rowFraction : 0;
    tops.push(Math.max(0, Math.max(hourOffset(range, start), previous)));
  }
  const overflow = tops.length ? tops.at(-1)! + rowFraction - 1 : 0;
  if (overflow > 0) return tops.map((top) => Math.max(0, top - overflow));
  return tops;
}

export function titleLines(duration: number, hoursPerLine: number, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(duration / hoursPerLine)));
}

export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const suffix = whole >= 12 && whole < 24 ? "PM" : "AM";
  const twelve = whole % 12 || 12;
  return minutes ? `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}` : `${twelve} ${suffix}`;
}
