import { countdownItems } from "./countdowns.ts";
import { dateKey } from "./weather.ts";

// BC statutory dates (not employer-specific substitute days):
// https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/statutory-holidays
export function bcHolidays(year: number): { title: string; date: Date }[] {
  const monday = (month: number, first: number) => {
    const date = new Date(year, month - 1, first);
    date.setDate(first + (8 - date.getDay()) % 7);
    return date;
  };
  // Gregorian computus; Good Friday is two days before Easter Sunday.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  const goodFriday = new Date(year, Math.floor(n / 31) - 1, n % 31 - 1);
  return [
    { title: "New Year's Day", date: new Date(year, 0, 1) },
    { title: "Family Day", date: monday(2, 15) },
    { title: "Good Friday", date: goodFriday },
    { title: "Victoria Day", date: monday(5, 18) },
    { title: "Canada Day", date: new Date(year, 6, 1) },
    { title: "B.C. Day", date: monday(8, 1) },
    { title: "Labour Day", date: monday(9, 1) },
    { title: "National Day for Truth and Reconciliation", date: new Date(year, 8, 30) },
    { title: "Thanksgiving Day", date: monday(10, 8) },
    { title: "Remembrance Day", date: new Date(year, 10, 11) },
    { title: "Christmas Day", date: new Date(year, 11, 25) },
  ];
}

export function holidayCountdowns(today: Date) {
  return countdownItems([today.getFullYear(), today.getFullYear() + 1].flatMap(bcHolidays).map(({ title, date }) => ({
    calendar: { id: "bc-statutory-holidays" },
    event: { id: title, summary: title, start: { date: dateKey(date) }, end: { date: dateKey(date) } },
  })), today);
}

// Published district-wide dates; each school chooses one additional PD day.
// https://www.sd61.bc.ca/news-events/calendars/2026-2027-school-year-calendar/
// GNS: https://www.mygns.ca/wp-content/uploads/2026/03/2026_2027-School-Calendar.pdf
// Statutory closures are already supplied by holidayCountdowns. Breaks appear
// once at their start; closing ceremonies are not treated as days off.
export function schoolCountdowns(today: Date) {
  return countdownItems([
    ["2026-09-08", "GNS Orientation Day (no classes)"],
    ["2026-09-21", "SD61 PD Day"],
    ["2026-10-23", "SD61 PD Day"],
    ["2026-11-09", "GNS Mid-term Break"],
    ["2026-11-27", "SD61 PD Day"],
    ["2026-12-18", "GNS Winter Break (noon dismissal)"],
    ["2027-01-11", "GNS Faculty Planning Day"],
    ["2027-02-12", "SD61 & GNS PD Day"],
    ["2027-03-12", "GNS Faculty Planning Day"],
    ["2027-03-15", "GNS Spring Break"],
    ["2027-03-29", "GNS Easter Monday"],
    ["2027-05-21", "SD61 & GNS PD Day"],
  ].map(([date, summary]) => ({
    calendar: { id: "school-days-off-2026-2027" },
    event: { id: date, summary, start: { date }, end: { date } },
  })), today);
}
