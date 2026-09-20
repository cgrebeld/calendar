export type WeatherDetail = { label: string; value: number; unit: string };
export type HourWeather = { time: string; temperature: number; code: number; windSpeed?: number };
export type DayWeather = { date: string; code: number; high: number; low: number; sunrise?: string; sunset?: string; windMax?: number; details?: WeatherDetail[] };

export type WeatherReport = {
  current: { temperature: number; code: number; windSpeed: number; details?: WeatherDetail[] };
  days: DayWeather[];
  hours?: HourWeather[];
  units: { temperature: string; windSpeed: string };
  fetchedAt: string;
  timezone?: string;
  stale?: boolean;
};

export function weatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain", 71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains", 80: "Light rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Light snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with light hail", 99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? "Conditions unavailable";
}

export function upcomingHours(report: WeatherReport | undefined, now = new Date()): HourWeather[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: report?.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  const start = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:00`;
  return (report?.hours ?? []).filter((hour) => hour.time >= start && Number.isFinite(hour.temperature)).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 24);
}

export function weatherChartScale(days: Pick<DayWeather, "high" | "low">[]): { min: number; max: number; ticks: number[] } {
  const values = days.flatMap(({ high, low }) => [high, low]).filter(Number.isFinite);
  if (!values.length) return { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] };
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * 0.1, 1);
  const roughStep = (high - low + padding * 2) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= roughStep) ?? 10) * magnitude;
  const first = Math.floor((low - padding) / step), last = Math.ceil((high + padding) / step);
  const ticks = Array.from({ length: last - first + 1 }, (_, index) => Number(((first + index) * step).toPrecision(12)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

export function windStrength(speed: number | undefined, unit: string): number | undefined {
  if (speed == null || !Number.isFinite(speed)) return undefined;
  const divisor = ({ "km/h": 1.852, kmh: 1.852, mph: 1.15078, "m/s": 0.514444 } as Record<string, number>)[unit.trim().toLowerCase()] ?? 1;
  return Math.max(0, Math.min(1, speed / divisor / 30));
}

export async function loadWeather(apiUrl: string): Promise<WeatherReport> {
  const response = await fetch(`${apiUrl}/api/weather`);
  if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
  return response.json();
}

export function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type WeatherIcon = "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" | "cold";

export function weatherIcon(day: DayWeather, coldThreshold = 0): WeatherIcon {
  const { code, high } = day;
  const precipitation = (code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 86) || (code >= 95 && code <= 99);
  if (precipitation || high > coldThreshold) {
    if (code === 0) return "sun";
    if (code <= 2) return "partly";
    if (code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 84)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95 && code <= 99) return "storm";
    return "cloud";
  }
  return "cold";
}

const glyphs: Record<WeatherIcon, string> = { sun: "☀️", partly: "🌤️", cloud: "☁️", fog: "🌫️", rain: "🌧️", snow: "❄️", storm: "⛈️", cold: "🥶" };

export function weatherGlyph(day: DayWeather, coldThreshold = 0): string {
  return glyphs[weatherIcon(day, coldThreshold)];
}

export function fakeForecast(today: Date): Map<string, DayWeather> {
  const codes = [0, 1, 3, 45, 61, 71, 80, 95, 0, 2, 3, 48, 63, 73, 86, 0];
  const forecast = new Map<string, DayWeather>();
  for (let offset = -7; offset <= 8; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const key = dateKey(date);
    const high = offset === 4 ? -3 : 11 + ((offset + 7) * 5) % 9;
    forecast.set(key, { date: key, code: codes[offset + 7], high, low: high - 6, sunrise: "06:45", sunset: "19:30" });
  }
  return forecast;
}
