import { parseHour } from "./schedule.ts";

export type ThemeName = "light" | "dark";
export type ThemeMode = ThemeName | "auto";
export type ThemeSchedule = { lightStart: number; darkStart: number };

export const defaultThemeSchedule: ThemeSchedule = { lightStart: 7, darkStart: 20 };

export function parseThemeSchedule(lightStart?: string, darkStart?: string): ThemeSchedule {
  const light = parseHour(lightStart);
  const dark = parseHour(darkStart);
  if (light === undefined || dark === undefined || dark <= light) return defaultThemeSchedule;
  return { lightStart: light, darkStart: dark };
}

export function scheduleFromSolar(day: { sunrise?: string; sunset?: string } | undefined, fallback: ThemeSchedule): ThemeSchedule {
  const sunrise = parseHour(day?.sunrise);
  const sunset = parseHour(day?.sunset);
  if (sunrise === undefined || sunset === undefined) return fallback;
  return { lightStart: sunrise + 0.25, darkStart: sunset + 0.5 };
}

export function resolveTheme(mode: ThemeMode, now: Date, schedule: ThemeSchedule): ThemeName {
  if (mode !== "auto") return mode;
  const hour = now.getHours() + now.getMinutes() / 60;
  return hour >= schedule.lightStart && hour < schedule.darkStart ? "light" : "dark";
}

export function parseThemeMode(value?: string | null): ThemeMode {
  return value === "light" || value === "dark" ? value : "auto";
}

export type SkinName = "default" | "woodland";

export function parseSkin(value?: string | null): SkinName {
  return value === "woodland" ? value : "default";
}

function dayOfYear(date: Date): number {
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86400000);
}

export function backgroundFor(theme: ThemeName, date: Date, count = 3): string {
  return `/backgrounds/${theme}-${(dayOfYear(date) % count) + 1}.webp`;
}
