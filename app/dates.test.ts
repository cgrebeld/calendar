import assert from "node:assert/strict";
import test from "node:test";
import { bcHolidays, holidayCountdowns, schoolCountdowns } from "./holidays.ts";

test("SD61 PD countdowns use published 2026–2027 dates within the six-month window", () => {
  const fall = schoolCountdowns(new Date(2026, 8, 19)).filter(({ title }) => title.includes("SD61"));
  assert.deepEqual(fall.map(({ date }) => dateKey(date)), ["2026-09-21", "2026-10-23", "2026-11-27", "2027-02-12"]);
  assert.equal(fall[0].title, "2 days until SD61 PD Day");
  const spring = schoolCountdowns(new Date(2027, 0, 1)).filter(({ title }) => title.includes("SD61"));
  assert.deepEqual(spring.map(({ date }) => dateKey(date)), ["2027-02-12", "2027-05-21"]);
  assert.equal(schoolCountdowns(new Date(2027, 4, 21))[0].title, "0 days until SD61 & GNS PD Day");
  assert.deepEqual(schoolCountdowns(new Date(2027, 4, 22)), []);
});

test("GNS days off include break starts, planning days and shared PD days without duplicate holidays", () => {
  const fall = schoolCountdowns(new Date(2026, 8, 1));
  assert.deepEqual(fall.filter(({ title }) => title.includes("GNS")).map(({ date }) => dateKey(date)),
    ["2026-09-08", "2026-11-09", "2026-12-18", "2027-01-11", "2027-02-12"]);
  assert.ok(fall.find(({ title }) => title.includes("noon dismissal")));
  const spring = [...holidayCountdowns(new Date(2027, 0, 1)), ...schoolCountdowns(new Date(2027, 0, 1))];
  for (const date of ["2027-02-12", "2027-02-15", "2027-03-26", "2027-05-21", "2027-05-24"]) {
    assert.equal(spring.filter((item) => dateKey(item.date) === date).length, 1, date);
  }
  assert.ok(spring.some(({ date, title }) => dateKey(date) === "2027-03-29" && title.includes("Easter Monday")));
  assert.deepEqual(schoolCountdowns(new Date(2027, 8, 1)), []);
});

test("BC statutory dates match the official 2026 and 2027 lists", () => {
  for (const [year, dates] of [
    [2026, ["01-01", "02-16", "04-03", "05-18", "07-01", "08-03", "09-07", "09-30", "10-12", "11-11", "12-25"]],
    [2027, ["01-01", "02-15", "03-26", "05-24", "07-01", "08-02", "09-06", "09-30", "10-11", "11-11", "12-25"]],
  ] as const) {
    assert.deepEqual(bcHolidays(year).map(({ date }) => dateKey(date)), dates.map((date) => `${year}-${date}`));
  }
  const items = holidayCountdowns(new Date(2026, 8, 19));
  assert.equal(items.length, 6);
  assert.equal(items[0].title, "11 days until National Day for Truth and Reconciliation");
  assert.ok(items.some(({ title }) => title.endsWith("Family Day")));
  assert.ok(!items.some(({ title }) => /Boxing|Easter|Good Friday/.test(title)));
});
import { upcomingHours, type WeatherReport } from "./weather.ts";

test("hourly outlook uses forecast timezone, excludes missing data and limits to 24 hours", () => {
  assert.deepEqual(upcomingHours(undefined), []);
  const report = { timezone: "America/Vancouver", hours: [
    { time: "2026-09-19T09:00", temperature: 10, code: 0 },
    { time: "2026-09-19T10:00", temperature: NaN, code: 0 },
    ...Array.from({ length: 24 }, (_, i) => ({ time: `2026-09-20T${String(i).padStart(2, "0")}:00`, temperature: 15, code: 0 })),
    { time: "2026-09-19T08:00", temperature: 9, code: 0 },
  ] } as WeatherReport;
  const hours = upcomingHours(report, new Date("2026-09-19T16:30:00Z"));
  assert.equal(hours.length, 24);
  assert.equal(hours[0].time, "2026-09-19T09:00");
  assert.equal(hours.at(-1)!.time, "2026-09-20T22:00");
});
import { countdownItems, countdownRange } from "./countdowns.ts";
import { execFileSync } from "node:child_process";
import { moonPhaseInstant, moonPhaseOn, type MoonPhase } from "./moon.ts";
import { addDays, moveAnchor, swipeDirection, viewDates, viewTitle } from "./dates.ts";
import { convertGoogleEvent, layoutEvents, type CalendarEvent } from "./google-calendar.ts";
import { defaultScheduleRange, hourLabels, hourOf, hourOffset, parseScheduleRange, placeRows, timeMarkerOffset, titleLines } from "./schedule.ts";
import { dateKey, fakeForecast, weatherChartScale, weatherDescription, weatherGlyph, weatherIcon, windStrength, type DayWeather } from "./weather.ts";
import { backgroundFor, defaultThemeSchedule, parseSkin, parseThemeMode, parseThemeSchedule, resolveTheme, scheduleFromSolar } from "./theme.ts";

const publishedMoonPhases: [number, MoonPhase, string][] = [
  [321, "full", "2026-01-03T10:03:00Z"],
  [322, "new", "2026-01-18T19:52:00Z"],
  [322, "full", "2026-02-01T22:09:00Z"],
  [323, "new", "2026-02-17T12:01:00Z"],
  [323, "full", "2026-03-03T11:38:00Z"],
  [327, "new", "2026-06-15T02:54:00Z"],
  [327, "full", "2026-06-29T23:56:00Z"],
  [333, "new", "2026-12-09T00:52:00Z"],
  [333, "full", "2026-12-24T01:28:00Z"],
];

test("countdowns cover six calendar months and clamp month ends", () => {
  const { from, to } = countdownRange(new Date(2026, 7, 31, 17));
  assert.equal(from.getHours(), 0);
  assert.equal(dateKey(to), "2027-02-28");
});

test("countdowns sort dates, strip labels, and exclude past and out-of-range starts", () => {
  const today = new Date(2026, 8, 19, 17);
  const entry = (id: string, date: string, summary = "Flight to Japan #countdown") => ({
    calendar: { id: "family" }, event: { id, summary, start: { date }, end: { date } },
  });
  const items = countdownItems([
    entry("flight", "2026-10-31"), entry("past", "2026-09-18"),
    entry("tomorrow", "2026-09-20"), entry("today", "2026-09-19"),
    entry("limit", "2027-03-19"), entry("bad", "invalid"),
  ], today);
  assert.deepEqual(items.map(({ title }) => title), [
    "0 days until Flight to Japan", "1 day until Flight to Japan", "42 days until Flight to Japan",
  ]);
});

test("countdown day counts follow local dates across DST", () => {
  const script = `import { countdownItems } from './countdowns.ts';
    const items = countdownItems([{calendar: {id: 'a'}, event: {id: '1', summary: 'Trip', start: {dateTime: '2026-11-02T00:30:00-08:00'}, end: {}}}], new Date(2026, 9, 31, 23));
    console.log(items[0].title);`;
  assert.equal(execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: import.meta.dirname, env: { ...process.env, TZ: "America/Vancouver" }, encoding: "utf8" }).trim(), "2 days until Trip");
});

test("Meeus instants agree within two minutes with https://aa.usno.navy.mil/calculated/moon/phases?year=2026", () => {
  for (const [lunation, phase, utc] of publishedMoonPhases) {
    const actual = moonPhaseInstant(lunation, phase);
    assert.ok(Math.abs(actual.getTime() - Date.parse(utc)) < 120000, `${phase}: ${actual.toISOString()} versus ${utc}`);
  }
});

test("moon phases mark only the local event date, independent of time of day", () => {
  for (const [, phase, utc] of publishedMoonPhases) {
    const event = new Date(utc);
    const original = event.getTime();
    assert.equal(moonPhaseOn(event), phase);
    assert.equal(event.getTime(), original);
    for (const hour of [0, 12, 23]) {
      const day = new Date(event.getFullYear(), event.getMonth(), event.getDate(), hour);
      assert.equal(moonPhaseOn(day), phase);
      assert.equal(moonPhaseOn(addDays(day, -1)), undefined);
      assert.equal(moonPhaseOn(addDays(day, 1)), undefined);
    }
  }
  assert.equal(moonPhaseOn(new Date(NaN)), undefined);
});

test("moon phase dates follow isolated local timezones and DST day lengths", () => {
  const moduleUrl = new URL("./moon.ts", import.meta.url).href;
  for (const [timezone, expected] of [
    ["UTC", ["2026-06-29", "2026-12-09"]],
    ["America/New_York", ["2026-06-29", "2026-12-08"]],
    ["Asia/Tokyo", ["2026-06-30", "2026-12-09"]],
    ["Pacific/Kiritimati", ["2026-06-30", "2026-12-09"]],
  ] as const) {
    const output = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import { moonPhaseOn } from ${JSON.stringify(moduleUrl)};
      const dates = ${JSON.stringify(expected)};
      for (const [index, key] of dates.entries()) {
        const [year, month, day] = key.split("-").map(Number);
        assert.equal(moonPhaseOn(new Date(year, month - 1, day)), index === 0 ? "full" : "new");
        for (const offset of [-1, 1]) assert.equal(moonPhaseOn(new Date(year, month - 1, day + offset)), undefined);
      }
      if (process.env.TZ === "America/New_York") {
        for (const hour of [0, 12, 23]) assert.equal(moonPhaseOn(new Date(2024, 2, 10, hour)), "new");
        assert.equal(moonPhaseOn(new Date(2024, 2, 9)), undefined);
        assert.equal(moonPhaseOn(new Date(2024, 2, 11)), undefined);
        for (const [month, day, hours] of [[2, 8, 23], [10, 1, 25]]) {
          const start = new Date(2026, month, day);
          const end = new Date(2026, month, day + 1);
          assert.equal((end - start) / 3600000, hours);
          assert.equal(moonPhaseOn(start), undefined);
          assert.equal(moonPhaseOn(new Date(end.getTime() - 1)), undefined);
        }
      }
      console.log("ok");
    `], { env: { ...process.env, TZ: timezone }, encoding: "utf8" });
    assert.equal(output.trim(), "ok", timezone);
  }
});

test("weather descriptions distinguish conditions and handle unknown codes", () => {
  assert.equal(weatherDescription(0), "Clear sky");
  assert.equal(weatherDescription(67), "Heavy freezing rain");
  assert.equal(weatherDescription(99), "Thunderstorm with heavy hail");
  assert.equal(weatherDescription(-1), "Conditions unavailable");
});

test("weather chart scale pads negative highs and lows with nice shared ticks", () => {
  const scale = weatherChartScale([{ date: "2026-01-01", code: 0, high: -5, low: -15 }]);
  assert.deepEqual(scale, { min: -20, max: 0, ticks: [-20, -15, -10, -5, 0] });
});

test("weather chart scale pads equal temperatures including zero", () => {
  for (const temperature of [-8, 0, 12]) {
    const { min, max, ticks } = weatherChartScale([{ date: "2026-01-01", code: 0, high: temperature, low: temperature }]);
    assert.ok(min < temperature && max > temperature);
    assert.ok(ticks.length >= 4 && ticks.length <= 7);
    assert.ok(ticks.every(Number.isFinite));
    assert.equal(ticks[0], min);
    assert.equal(ticks.at(-1), max);
  }
});

test("weather chart scale handles empty input and ignores missing or nonfinite values", () => {
  const empty = weatherChartScale([]);
  assert.deepEqual(empty, { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] });
  const invalid = [null, undefined, NaN, Infinity, -Infinity].map((value) => ({ date: "2026-01-01", code: 0, high: value, low: value })) as unknown as DayWeather[];
  assert.deepEqual(weatherChartScale(invalid), empty);
  const day = { date: "2026-01-01", code: 0, high: 20, low: 10 };
  assert.deepEqual(weatherChartScale([...invalid, day]), weatherChartScale([day]));
  assert.deepEqual(weatherChartScale([{ ...day, low: null } as unknown as DayWeather]), weatherChartScale([{ ...day, low: 20 }]));
});

test("wind strength distinguishes missing readings from calm and clamps its range", () => {
  for (const speed of [undefined, null, NaN, Infinity, -Infinity]) {
    assert.equal(windStrength(speed as number | undefined, "kn"), undefined);
  }
  assert.equal(windStrength(0, "kn"), 0);
  assert.equal(windStrength(-10, "kn"), 0);
  assert.equal(windStrength(60, "kn"), 1);
});

test("wind strength normalizes equivalent speeds to a 30-knot scale", () => {
  for (const [unit, divisor] of [["km/h", 1.852], ["kmh", 1.852], ["mph", 1.15078], ["m/s", 0.514444], ["kn", 1], ["kt", 1], ["unknown", 1]] as const) {
    assert.ok(Math.abs(windStrength(15 * divisor, unit)! - 0.5) < 1e-12);
    assert.ok(Math.abs(windStrength(30 * divisor, unit)! - 1) < 1e-12);
    assert.equal(windStrength(60 * divisor, unit), 1);
  }
});

test("calendar queries cover the entire first and last dates in every view", () => {
  const anchor = new Date(2026, 8, 19, 16, 45, 12, 123);
  for (const mode of ["day", "week", "twoWeek", "month"] as const) {
    const dates = viewDates(anchor, mode);
    for (const date of dates) assert.equal(date.getHours() + date.getMinutes() + date.getSeconds() + date.getMilliseconds(), 0);
    const morning = new Date(dates[0]);
    morning.setHours(8);
    assert.ok(morning >= dates[0]);
    const lastEvening = new Date(dates.at(-1)!);
    lastEvening.setHours(23, 59);
    assert.ok(lastEvening < addDays(dates.at(-1)!, 1));
  }
  assert.equal(anchor.getHours(), 16);
});

test("addDays crosses month boundaries", () => {
  assert.equal(addDays(new Date(2026, 0, 31), 1).getDate(), 1);
});

test("calendar modes return the expected ranges", () => {
  const wednesday = new Date(2026, 8, 9);
  assert.deepEqual(["day", "week", "twoWeek", "month"].map((mode) => viewDates(wednesday, mode as Parameters<typeof viewDates>[1]).length), [3, 7, 14, 42]);
  assert.equal(viewDates(wednesday, "week")[0].getDay(), 0);
  assert.equal(moveAnchor(wednesday, "twoWeek", 1).getDate(), 23);
});

test("horizontal swipes navigate only after a deliberate gesture", () => {
  assert.equal(swipeDirection(-80, 10), 1);
  assert.equal(swipeDirection(80, -10), -1);
  assert.equal(swipeDirection(49, 0), 0);
  assert.equal(swipeDirection(80, 100), 0);
});

test("day view returns three consecutive dates centered on the anchor", () => {
  const day = viewDates(new Date(2026, 8, 9), "day");
  assert.deepEqual(day.map((date) => date.getDate()), [8, 9, 10]);
  const boundary = viewDates(new Date(2026, 9, 1), "day");
  assert.deepEqual(boundary.map((date) => `${date.getMonth() + 1}/${date.getDate()}`), ["9/30", "10/1", "10/2"]);
});

test("viewTitle summarizes the visible range", () => {
  const day = (anchor: Date) => viewTitle(viewDates(anchor, "day"), "day", anchor);
  assert.equal(day(new Date(2026, 9, 15)), "October 2026");
  assert.equal(day(new Date(2026, 9, 1)), "Sep – Oct 2026");
  assert.equal(day(new Date(2027, 0, 1)), "Dec 2026 – Jan 2027");
  const weekAnchor = new Date(2026, 8, 9);
  assert.equal(viewTitle(viewDates(weekAnchor, "week"), "week", weekAnchor), "Sep 6 – Sep 12");
  assert.equal(viewTitle(viewDates(weekAnchor, "month"), "month", weekAnchor), "September 2026");
});

test("Google all-day events keep their local calendar date", () => {
  const event = convertGoogleEvent({ summary: "Trip", start: { date: "2026-09-12" }, end: { date: "2026-09-13" } }, { id: "family", summary: "Family" }, "family", new Date(2026, 8, 11));
  assert.equal(event.day, 1);
  assert.equal(event.allDay, true);
});

test("overlapping events stack vertically", () => {
  const makeEvent = (start: number, duration: number): CalendarEvent => ({ day: 0, person: "Family", tone: "family", start, duration, title: `${start}`, detail: "" });
  const laidOut = layoutEvents([makeEvent(9, 3), makeEvent(10, 1), makeEvent(13, 1)]);
  assert.deepEqual(laidOut.map(({ start, duration }) => [start, duration]), [[9, 3], [12, 1], [13, 1]]);
});

test("a crowded event stack compresses to the schedule end", () => {
  const makeEvent = (start: number): CalendarEvent => ({ day: 0, person: "Family", tone: "family", start, duration: 3, title: `${start}`, detail: "" });
  const laidOut = layoutEvents([9, 10, 11, 12, 13].map(makeEvent));
  assert.ok(laidOut.every((item, index) => !index || item.start >= laidOut[index - 1].start + laidOut[index - 1].duration));
  assert.ok(laidOut.at(-1)!.start + laidOut.at(-1)!.duration <= defaultScheduleRange.endHour);
});

test("parseScheduleRange parses HH:MM and bare hours", () => {
  assert.deepEqual(parseScheduleRange("06:30", "22"), { startHour: 6.5, endHour: 22 });
});

test("parseScheduleRange falls back to defaults on invalid input", () => {
  assert.deepEqual(defaultScheduleRange, { startHour: 7, endHour: 22 });
  assert.deepEqual(parseScheduleRange("20", "08"), defaultScheduleRange);
  assert.deepEqual(parseScheduleRange(undefined, undefined), defaultScheduleRange);
  assert.deepEqual(parseScheduleRange("abc", "20"), defaultScheduleRange);
  assert.deepEqual(parseScheduleRange("06:00", "25"), defaultScheduleRange);
});

test("hourLabels steps by 2 for wide ranges", () => {
  assert.deepEqual(hourLabels({ startHour: 8, endHour: 20 }), [8, 10, 12, 14, 16, 18, 20]);
  assert.deepEqual(hourLabels({ startHour: 9, endHour: 15 }), [9, 10, 11, 12, 13, 14, 15]);
});

test("hourOffset returns the fraction of the range", () => {
  assert.equal(hourOffset({ startHour: 8, endHour: 20 }, 14), 0.5);
});

test("titleLines scales with duration and respects the cap", () => {
  assert.equal(titleLines(0.5, 0.5, 3), 1);
  assert.equal(titleLines(1, 0.5, 3), 2);
  assert.equal(titleLines(1.5, 0.5, 3), 3);
  assert.equal(titleLines(4, 0.5, 3), 3);
  assert.equal(titleLines(0.5, 0.75, 2), 1);
});

test("a wider range avoids compressing stacks that fit", () => {
  const makeEvent = (start: number): CalendarEvent => ({ day: 0, person: "Family", tone: "family", start, duration: 3, title: `${start}`, detail: "" });
  const laidOut = layoutEvents([9, 12, 15, 18].map(makeEvent), 1, { startHour: 6, endHour: 22 });
  assert.deepEqual(laidOut.map(({ start, duration }) => [start, duration]), [[9, 3], [12, 3], [15, 3], [18, 3]]);
  assert.ok(laidOut.every(({ start }) => start >= 6));
});

test("weatherGlyph maps each WMO code band", () => {
  const day = (code: number, high = 10) => ({ date: "2026-09-12", code, high, low: high - 5 });
  assert.equal(weatherGlyph(day(0)), "☀️");
  assert.equal(weatherGlyph(day(1)), "🌤️");
  assert.equal(weatherGlyph(day(3)), "☁️");
  assert.equal(weatherGlyph(day(45)), "🌫️");
  assert.equal(weatherGlyph(day(61)), "🌧️");
  assert.equal(weatherGlyph(day(71)), "❄️");
  assert.equal(weatherGlyph(day(80)), "🌧️");
  assert.equal(weatherGlyph(day(95)), "⛈️");
});

test("weatherGlyph cold override loses to precipitation", () => {
  const day = (code: number) => ({ date: "2026-09-12", code, high: -2, low: -8 });
  assert.equal(weatherGlyph(day(0)), "🥶");
  assert.equal(weatherGlyph(day(61)), "🌧️");
});

test("weatherIcon keys every code family", () => {
  const day = (code: number, high = 15) => ({ date: "2026-01-01", code, high, low: 5 });
  assert.equal(weatherIcon(day(0)), "sun");
  assert.equal(weatherIcon(day(2)), "partly");
  assert.equal(weatherIcon(day(3)), "cloud");
  assert.equal(weatherIcon(day(48)), "fog");
  assert.equal(weatherIcon(day(61)), "rain");
  assert.equal(weatherIcon(day(73)), "snow");
  assert.equal(weatherIcon(day(95)), "storm");
  assert.equal(weatherIcon(day(0, -3)), "cold");
  assert.equal(weatherIcon(day(61, -3)), "rain");
});

test("dateKey formats the local calendar date", () => {
  assert.equal(dateKey(new Date(2026, 8, 12)), "2026-09-12");
});

test("fakeForecast covers sixteen days including today", () => {
  const today = new Date(2026, 8, 12);
  const forecast = fakeForecast(today);
  assert.equal(forecast.size, 16);
  assert.ok(forecast.has(dateKey(today)));
  assert.ok(forecast.has(dateKey(addDays(today, -7))));
  assert.ok(forecast.has(dateKey(addDays(today, 8))));
});

test("parseThemeSchedule parses times and falls back on invalid input", () => {
  assert.deepEqual(parseThemeSchedule("06:30", "21"), { lightStart: 6.5, darkStart: 21 });
  assert.deepEqual(parseThemeSchedule("21", "06:30"), defaultThemeSchedule);
  assert.deepEqual(parseThemeSchedule(undefined, undefined), defaultThemeSchedule);
  assert.deepEqual(parseThemeSchedule("abc", "20"), defaultThemeSchedule);
});

test("scheduleFromSolar offsets sunrise and sunset", () => {
  assert.deepEqual(scheduleFromSolar({ sunrise: "06:45", sunset: "19:30" }, defaultThemeSchedule), { lightStart: 7, darkStart: 20 });
  assert.deepEqual(scheduleFromSolar({ sunrise: "06:45" }, defaultThemeSchedule), defaultThemeSchedule);
  assert.deepEqual(scheduleFromSolar(undefined, defaultThemeSchedule), defaultThemeSchedule);
});

test("resolveTheme applies the schedule in auto mode", () => {
  const at = (hour: number, minute = 0) => new Date(2026, 8, 12, hour, minute);
  assert.equal(resolveTheme("auto", at(12), defaultThemeSchedule), "light");
  assert.equal(resolveTheme("auto", at(21), defaultThemeSchedule), "dark");
  assert.equal(resolveTheme("auto", at(6, 59), defaultThemeSchedule), "dark");
  assert.equal(resolveTheme("auto", at(7), defaultThemeSchedule), "light");
  assert.equal(resolveTheme("auto", at(20), defaultThemeSchedule), "dark");
  assert.equal(resolveTheme("dark", at(12), defaultThemeSchedule), "dark");
  assert.equal(resolveTheme("light", at(23), defaultThemeSchedule), "light");
});

test("parseSkin falls back to default", () => {
  assert.equal(parseSkin("woodland"), "woodland");
  assert.equal(parseSkin("light"), "default");
  assert.equal(parseSkin(undefined), "default");
  assert.equal(parseSkin(null), "default");
});

test("parseThemeMode accepts only light and dark", () => {
  assert.equal(parseThemeMode("dark"), "dark");
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("auto"), "auto");
  assert.equal(parseThemeMode("bogus"), "auto");
  assert.equal(parseThemeMode(null), "auto");
});

test("hourOf converts a date to decimal hours", () => {
  assert.equal(hourOf(new Date(2026, 8, 12, 14, 30)), 14.5);
});

test("timeMarkerOffset is the identity on an empty day", () => {
  const range = defaultScheduleRange;
  assert.equal(timeMarkerOffset(14.5, [], range), 0.5);
  assert.equal(timeMarkerOffset(6.5, [], range), null);
  assert.equal(timeMarkerOffset(22.5, [], range), null);
  assert.equal(timeMarkerOffset(22, [], range), 1);
});

test("timeMarkerOffset follows laid-out coordinates on compressed days", () => {
  // An event actually starting at 16 pushed to a laid-out 17 by a preceding event.
  const makeEvent = (start: number, duration: number): CalendarEvent => ({ day: 0, person: "Family", tone: "family", start, duration, title: `${start}`, detail: "" });
  const laidOut = layoutEvents([makeEvent(15, 2), makeEvent(16, 1)], 1, defaultScheduleRange);
  const pushed = laidOut.find(({ event }) => event.start === 16)!;
  assert.equal(pushed.start, 17);
  const offset = timeMarkerOffset(16.25, laidOut, defaultScheduleRange)!;
  assert.ok(offset >= 2 / 3 && offset <= 0.7334, `offset ${offset} should sit inside the pushed event`);
});

test("placeRows positions rows at time offsets without overlap", () => {
  const range = defaultScheduleRange;
  assert.deepEqual(placeRows([7], range, 0.2), [0]);
  assert.ok(Math.abs(placeRows([19], range, 0.2)[0] - 0.8) < 1e-9);
  assert.deepEqual(placeRows([12, 12], range, 0.2).map((v) => Math.round(v * 1000) / 1000), [0.333, 0.533]);
  assert.deepEqual(placeRows([19, 19, 19], range, 0.2).map((v) => Math.round(v * 100) / 100), [0.4, 0.6, 0.8]);
});

test("convertGoogleEvent clamps early events to the range start", () => {
  const event = convertGoogleEvent(
    { summary: "Early", start: { dateTime: "2026-09-11T05:00:00" }, end: { dateTime: "2026-09-11T06:30:00" } },
    { id: "family", summary: "Family" },
    "family",
    new Date(2026, 8, 11),
    { startHour: 6, endHour: 22 },
  );
  assert.equal(event.start, 6);
});

test("backgroundFor rotates one image per day per theme", () => {
  assert.equal(backgroundFor("light", new Date(2026, 0, 1)), "/backgrounds/light-1.webp");
  assert.equal(backgroundFor("light", new Date(2026, 0, 2)), "/backgrounds/light-2.webp");
  assert.equal(backgroundFor("light", new Date(2026, 0, 4)), "/backgrounds/light-1.webp");
  assert.equal(backgroundFor("dark", new Date(2026, 0, 2)), "/backgrounds/dark-2.webp");
});
