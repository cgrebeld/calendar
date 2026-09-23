import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { addDays, moveAnchor, swipeDirection, viewDates, viewTitle, type ViewMode } from "./dates";
import { moonPhaseOn } from "./moon";
import { layoutEvents, loadGoogleEvents, type CalendarEvent } from "./google-calendar";
import { formatHour, hourLabels, hourOf, hourOffset, placeRows, scheduleHours, scheduleRangeFromEnv, timeMarkerOffset, titleLines, type ScheduleRange } from "./schedule";
import { dateKey, fakeForecast, loadWeather, upcomingHours, weatherChartScale, weatherDescription, weatherGlyph, weatherIcon, windStrength, type DayWeather, type WeatherReport } from "./weather";
import { backgroundFor, parseSkin, parseThemeMode, parseThemeSchedule, resolveTheme, scheduleFromSolar, type ThemeMode, type ThemeName } from "./theme";
import "./style.css";
import { WoodlandBackground } from "./skins/woodland";
import { DateTime } from "./date-time";
import { DogCompanion } from "./dog";
import { Countdowns } from "./countdown-list";
import { ApplicationUpdates } from "./updates";
import { PhotoIcon, PhotoMode, PhotoSettings } from "./photos";

const themeMode = parseThemeMode(new URLSearchParams(location.search).get("theme") ?? import.meta.env.VITE_THEME_MODE);
const skin = parseSkin(new URLSearchParams(location.search).get("skin") ?? import.meta.env.VITE_SKIN);
document.documentElement.dataset.skin = skin;
const envThemeSchedule = parseThemeSchedule(import.meta.env.VITE_THEME_LIGHT_START, import.meta.env.VITE_THEME_DARK_START);

const scheduleRange = scheduleRangeFromEnv();
const coldThreshold = Number(import.meta.env.VITE_WEATHER_COLD_THRESHOLD ?? 0);
const backgroundDisabled = import.meta.env.VITE_BACKGROUND === "none";
const backgroundOverrides: Record<ThemeName, string | undefined> = {
  light: import.meta.env.VITE_BACKGROUND_LIGHT,
  dark: import.meta.env.VITE_BACKGROUND_DARK,
};

const fakeEvents: CalendarEvent[] = [
  { day: 0, person: "Alex", tone: "alex", start: 8, duration: 1, title: "Dentist", detail: "Dr. Chen · 123 Main Street" },

  { day: 0, person: "Sam", tone: "sam", start: 15.5, duration: 1.5, title: "Soccer practice at North field", detail: "Bring water" },
  { day: 0, person: "Family", tone: "family", start: 18, duration: 1.5, title: "Dinner with grandparents", detail: "At Grandma and Grandpa’s" },
  { day: 1, person: "Maya", tone: "maya", start: 8, duration: 1, title: "Library books due", detail: "Return books after school", allDay: true },
  { day: 1, person: "Alex", tone: "alex", start: 10, duration: 1, title: "Grocery pickup", detail: "Save-On-Foods" },
  { day: 2, person: "Family", tone: "family", start: 11.5, duration: 1.5, title: "Brunch", detail: "The Corner Café" },
  { day: 2, person: "Maya", tone: "maya", start: 8.5, duration: 1, title: "Grade 6 orientation", detail: "Gymnasium" },
  { day: 2, person: "Family", tone: "family", start: 9, duration: 1, title: "Clio's school drop-off", detail: "" },
  { day: 2, person: "Sam", tone: "sam", start: 12, duration: 1, title: "New grade 8 students welcome", detail: "Library" },
  { day: 2, person: "Alex", tone: "alex", start: 13, duration: 1.5, title: "MEDD411 CS: Intro to Communication", detail: "Room 204" },
  { day: 2, person: "Sam", tone: "sam", start: 15.5, duration: 1, title: "Grade 8 get together", detail: "" },
  { day: 2, person: "Family", tone: "family", start: 18, duration: 1.5, title: "Birthday dinner", detail: "Nonna's" },
  { day: 3, person: "Sam", tone: "sam", start: 8, duration: 1, title: "School band rehearsal", detail: "Music room" },
  { day: 3, person: "Maya", tone: "maya", start: 16, duration: 1, title: "Piano lesson with Ms. Nakamura", detail: "Bring lesson book" },
  { day: 4, person: "Family", tone: "family", start: 8, duration: 1, title: "Recycling day", detail: "Put bins out the night before", allDay: true },
  { day: 5, person: "Alex", tone: "alex", start: 17.5, duration: 1, title: "Yoga at the community centre", detail: "Drop-in class" },
  { day: 6, person: "Family", tone: "family", start: 18.5, duration: 1, title: "Taco night", detail: "Maya is choosing the toppings" },
];

const modes: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "twoWeek", label: "2 weeks" },
  { id: "month", label: "Month" },
];
type NoteList = { id: string; label: string; items: { id: string; title: string }[] };
const noteLists: NoteList[] = [
  { id: "reminders", label: "Reminders", items: ["Pick up dry cleaning", "Order Maya’s school photos", "Replace hallway light bulb", "Call Grandma this weekend"].map((title, id) => ({ id: `reminder-${id}`, title })) },
  { id: "groceries", label: "Groceries", items: ["Milk", "Bananas", "Coffee beans", "Dish soap", "Cheddar"].map((title, id) => ({ id: `grocery-${id}`, title })) },
];
const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

let uiAudioContext: AudioContext | undefined;

function playButtonSound(sound: "beep" | "boop") {
  try {
    uiAudioContext ??= new AudioContext();
    if (uiAudioContext.state === "suspended") void uiAudioContext.resume().catch(() => {});

    const now = uiAudioContext.currentTime;
    const duration = sound === "beep" ? 0.07 : 0.11;
    const oscillator = uiAudioContext.createOscillator();
    const gain = uiAudioContext.createGain();

    oscillator.type = sound === "beep" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(sound === "beep" ? 640 : 330, now);
    oscillator.frequency.exponentialRampToValueAtTime(sound === "beep" ? 880 : 180, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(uiAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Audio feedback must never prevent the button action.
  }
}


function useButtonSounds() {
  useEffect(() => {
    const play = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (target) playButtonSound(target.getAttribute("data-sound") === "boop" ? "boop" : "beep");
    };
    document.addEventListener("click", play, true);
    return () => document.removeEventListener("click", play, true);
  }, []);
}

const dayTap = (onOpenDay: (date: Date) => void, date: Date) => (event: React.MouseEvent) => {
  if ((event.target as Element).closest("button")) return;
  onOpenDay(date);
};


function sameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

function eventTime(event: CalendarEvent) {
  if (event.timeLabel) return event.timeLabel;
  if (event.allDay) return "All day";
  const date = new Date(2000, 0, 1, Math.floor(event.start), (event.start % 1) * 60);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function eventsFor(events: CalendarEvent[], date: Date, today: Date) {
  return events.filter((event) => sameDay(date, addDays(today, event.day)));
}

function DayWeatherBadge({ date, day, compact }: { date: Date; day?: DayWeather; compact?: boolean }) {
  const phase = moonPhaseOn(date);
  if (!day && !phase) return null;
  return <div className="day-weather">
    {day && <><span className="glyph" data-icon={weatherIcon(day, coldThreshold)}>{weatherGlyph(day, coldThreshold)}</span>{!compact && `${Math.round(day.high)}°`}</>}
    {phase && <svg className="moon-icon" viewBox="0 0 24 24" role="img" aria-label={phase === "full" ? "Full moon" : "New moon"}>
      <title>{phase === "full" ? "Full moon" : "New moon"}</title>
      <circle cx="12" cy="12" r="10" fill={phase === "full" ? "#f5e6af" : "#263044"} stroke="#9b8c6c" strokeWidth="1.5" />
      {phase === "full" && <g fill="#d6c892"><circle cx="8" cy="8" r="2.5" /><circle cx="15" cy="14" r="3" /><circle cx="8" cy="16" r="1.5" /></g>}
    </svg>}
  </div>;
}

function Timeline({ dates, today, now, events, range, focus, forecast, onSelect, onOpenDay }: { dates: Date[]; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; focus?: Date; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
  const nowHour = hourOf(now);
  const todayShown = dates.some((date) => sameDay(date, now));
  const nearestLabel = todayShown ? hourLabels(range).reduce((best, hour) => (Math.abs(hour - nowHour) < Math.abs(best - nowHour) ? hour : best)) : undefined;
  return (
    <section className="timeline" style={{ "--days": dates.length } as React.CSSProperties}>
      <div className="corner">All day</div>
      {dates.map((date) => (
        <div className={`day-heading ${sameDay(date, today) ? "today" : ""} ${focus ? (sameDay(date, focus) ? "focus" : "context") : ""}`} key={`heading-${date.toDateString()}`} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
          <span>{dayName.format(date)}</span><strong>{date.getDate()}</strong>
          <DayWeatherBadge date={date} day={forecast.get(dateKey(date))} />
        </div>
      ))}
      <div className="time-labels">{hourLabels(range).map((hour) => <span className={hour === nearestLabel ? "now-near" : ""} style={{ top: `${hourOffset(range, hour) * 100}%` }} key={hour}>{formatHour(hour)}</span>)}</div>
      {dates.map((date) => {
        const dayEvents = eventsFor(events, date, today);
        const laidOut = layoutEvents(dayEvents.filter((event) => !event.allDay), 1, range);
        const nowOffset = sameDay(date, now) ? timeMarkerOffset(nowHour, laidOut, range) : null;
        return (
          <div className={`day-column ${sameDay(date, today) ? "today" : ""} ${focus ? (sameDay(date, focus) ? "focus" : "context") : ""}`} key={date.toDateString()} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
            <div className="all-day-lane">
              {dayEvents.filter((event) => event.allDay).map((event) => <button className={`all-day ${event.tone}`} onClick={() => onSelect(event)} key={event.title}>{event.title}</button>)}
            </div>
            <div className="hours" style={{ "--schedule-hours": scheduleHours(range) } as React.CSSProperties}>
              {nowOffset !== null && <div className="now-line" style={{ top: `${nowOffset * 100}%` }} aria-hidden />}
              {laidOut.map(({ event, start, duration }) => (
                <button
                  className={`timed-event ${event.tone}`}
                  style={{ top: `${hourOffset(range, start) * 100}%`, height: `${(duration / scheduleHours(range)) * 100}%`, "--title-lines": titleLines(duration, 0.5 * scheduleHours(range) / 12, 3) } as React.CSSProperties}
                  onClick={() => onSelect(event)}
                  key={`${event.start}-${event.title}`}
                >
                  <span>{eventTime(event)}</span><strong>{event.title}</strong>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function useRowCapacity() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [capacity, setCapacity] = useState(3);
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const styles = getComputedStyle(element);
      const row = (parseFloat(styles.getPropertyValue("--month-row")) || 1.4) * rem;
      const gap = (parseFloat(styles.getPropertyValue("--month-gap")) || 0.15) * rem;
      setCapacity(Math.max(1, Math.floor((element.clientHeight + gap) / (row + gap))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, capacity] as const;
}

function Month({ dates, anchor, today, now, events, range, forecast, onSelect, onOpenDay }: { dates: Date[]; anchor: Date; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
  const [capacityRef, capacity] = useRowCapacity();
  const hours = scheduleHours(range);
  return (
    <section className="month-grid">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong className="month-heading" key={day}>{day}</strong>)}
      {dates.map((date, index) => {
        const dayEvents = eventsFor(events, date, today).sort((left, right) => Number(right.allDay) - Number(left.allDay) || left.start - right.start);
        const isToday = sameDay(date, now);
        const rowFraction = 1 / capacity;
        if (dayEvents.length <= capacity) {
          const tops = placeRows(dayEvents.map((event) => (event.allDay ? range.startHour : event.start)), range, rowFraction);
          const laidOut = dayEvents.map((event, row) => ({ event: { start: event.allDay ? range.startHour : event.start, duration: rowFraction * hours }, start: range.startHour + tops[row] * hours, duration: rowFraction * hours }));
          const ruleTop = isToday && dayEvents.some((event) => !event.allDay) ? timeMarkerOffset(hourOf(now), laidOut, range) : null;
          return (
            <div className={`month-day ${date.getMonth() !== anchor.getMonth() ? "outside" : ""} ${sameDay(date, today) ? "today" : ""}`} key={date.toDateString()} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
              <span>{date.getDate()}</span>
              <DayWeatherBadge date={date} day={forecast.get(dateKey(date))} compact />
              <div className="month-events placed" ref={index === 0 ? capacityRef : undefined}>
                {ruleTop !== null && <div className="now-rule" style={{ top: `${ruleTop * 100}%` }} aria-hidden />}
                {dayEvents.map((event, row) => <button className={event.tone} style={{ top: `${tops[row] * 100}%` }} onClick={() => onSelect(event)} key={`${event.start}-${event.title}`} aria-label={`${eventTime(event)} ${event.title}`}>{event.title}</button>)}
              </div>
            </div>
          );
        }
        const visible = dayEvents.slice(0, Math.max(0, capacity - 1));
        const upcoming = isToday ? visible.find((event) => !event.allDay && event.start > hourOf(now)) : undefined;
        const showRule = isToday && dayEvents.some((event) => !event.allDay);
        return (
          <div className={`month-day ${date.getMonth() !== anchor.getMonth() ? "outside" : ""} ${sameDay(date, today) ? "today" : ""}`} key={date.toDateString()} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
            <span>{date.getDate()}</span>
            <DayWeatherBadge date={date} day={forecast.get(dateKey(date))} compact />
            <div className="month-events list" ref={index === 0 ? capacityRef : undefined}>
              {visible.map((event) => (
                <React.Fragment key={`${event.start}-${event.title}`}>
                  {event === upcoming && <div className="now-rule" aria-hidden />}
                  <button className={event.tone} onClick={() => onSelect(event)} aria-label={`${eventTime(event)} ${event.title}`}>{event.title}</button>
                </React.Fragment>
              ))}
              {showRule && !upcoming && <div className="now-rule" aria-hidden />}
              <button className="more" onClick={() => onOpenDay(date)}>⌄ {dayEvents.length - visible.length} more</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function TwoWeek({ dates, today, now, events, range, forecast, onSelect, onOpenDay }: { dates: Date[]; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
  return (
    <section className="two-week-grid">
      {dates.map((date) => {
        const dayEvents = eventsFor(events, date, today);
        const laidOut = layoutEvents(dayEvents.filter((event) => !event.allDay), 1.5, range);
        const nowOffset = sameDay(date, now) ? timeMarkerOffset(hourOf(now), laidOut, range) : null;
        return (
          <article className={`mini-day ${sameDay(date, today) ? "today" : ""}`} key={date.toDateString()} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
            <header><span>{dayName.format(date)}</span><strong>{date.getDate()}</strong><DayWeatherBadge date={date} day={forecast.get(dateKey(date))} /></header>
            <div className="mini-all-day">
              {dayEvents.filter((event) => event.allDay).map((event) => <button className={event.tone} onClick={() => onSelect(event)} key={event.title}>{event.title}</button>)}
            </div>
            <div className="mini-hours" style={{ "--schedule-hours": scheduleHours(range) } as React.CSSProperties}>
              {nowOffset !== null && <div className="now-line mini" style={{ top: `${nowOffset * 100}%` }} aria-hidden />}
              {laidOut.map(({ event, start, duration }) => (
                <button className={event.tone} style={{ top: `${hourOffset(range, start) * 100}%`, height: `${(duration / scheduleHours(range)) * 100}%`, "--title-lines": titleLines(duration, 0.75 * scheduleHours(range) / 12, 2) } as React.CSSProperties} onClick={() => onSelect(event)} key={`${event.start}-${event.title}`}>
                  <span>{eventTime(event)}</span><strong>{event.title}</strong>
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function DayModal({ date, today, now, events, range, forecast, onSelect, onClose }: { date: Date; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onClose: () => void }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <section className="day-modal" role="dialog" aria-modal="true" aria-label={longDate.format(date)} onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close" data-sound="boop">×</button>
        <h2>{longDate.format(date)}</h2>
        <Timeline dates={[date]} today={today} now={now} events={events} range={range} forecast={forecast} onSelect={onSelect} onOpenDay={() => {}} />
      </section>
    </div>
  );
}

function WeatherConditionIcon({ code }: { code: number }) {
  const icon = weatherIcon({ date: "", code, high: 1, low: 1 }, -Infinity);
  const sunny = icon === "sun" || icon === "partly";
  return <svg className="condition-icon" viewBox="0 0 80 80" role="img" aria-label={weatherDescription(code)}>
    <title>{weatherDescription(code)}</title>
    {sunny && <g transform={icon === "partly" ? "translate(26 28) scale(.8)" : "translate(40 40)"} fill="#edb757" stroke="#edb757" strokeWidth="3" strokeLinecap="round">
      <circle r="13" stroke="none" /><path d="M0-26v7M0 19v7M-26 0h7M19 0h7M-18-18l5 5M13 13l5 5M-18 18l5-5M13-13l5-5" />
    </g>}
    {icon !== "sun" && <path d="M18 49C3 49 4 29 18 28C18 8 48 7 53 28C74 22 81 49 61 49Z" fill="#a5b6cb" transform={icon === "partly" ? "translate(8 12) scale(.85)" : undefined} />}
    {icon === "fog" && <path d="M12 56h51M21 64h49M10 72h44" stroke="#8ea4b9" strokeWidth="3" strokeLinecap="round" />}
    {(icon === "rain" || icon === "storm") && <path d="M24 57l-5 10M42 57l-5 10M60 57l-5 10" stroke="#689cc9" strokeWidth="3" strokeLinecap="round" />}
    {icon === "storm" && <path d="M43 36l-9 18h9l-5 17 19-25H46l7-10Z" fill="#edb757" />}
    {icon === "snow" && <path d="M23 55v17M15 59l16 9M15 68l16-9M56 55v17M48 59l16 9M48 68l16-9" stroke="#689cc9" strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}

function WeatherModal({ report, forecast, onClose }: { report?: WeatherReport; forecast: Map<string, DayWeather>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const outlook = useRef<HTMLDivElement>(null);
  const hourlyOutlook = useRef<HTMLDivElement>(null);
  const hours = upcomingHours(report, useNow());
  const hourlyScale = weatherChartScale(hours.map((hour) => ({ high: hour.temperature, low: hour.temperature })));
  const hourlyPosition = (temperature: number) => (hourlyScale.max - temperature) / (hourlyScale.max - hourlyScale.min) * 100;
  useEffect(() => {
    const element = dialog.current!;
    const previouslyFocused = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  const todayKey = report?.timezone ? new Intl.DateTimeFormat("en-CA", { timeZone: report.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) : dateKey(new Date());
  const units = report?.units ?? { temperature: "°C", windSpeed: "kt" };
  const days = Array.from(forecast.values()).filter((day) => day.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date));
  const scale = weatherChartScale(days);
  const position = (temperature: number) => (scale.max - temperature) / (scale.max - scale.min) * 100;
  const value = (number: number | undefined, unit = "") => Number.isFinite(number) ? `${Number(number!.toFixed(1))} ${unit}`.trim() : "Unavailable";
  return (
    <dialog ref={dialog} className="weather-modal" aria-labelledby="weather-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <button className="close" onClick={onClose} aria-label="Close weather details" data-sound="boop">×</button>
      <div className="weather-content">
        <p className="eyebrow">Conditions & forecast</p>
        <h2 id="weather-title">Weather details</h2>
        <p className="weather-meta">{report ? `Open-Meteo · Updated ${new Date(report.fetchedAt).toLocaleString()}` : "Demo forecast · Live weather is unavailable"}{report?.timezone && ` · ${report.timezone}`}</p>
        {report?.stale && <p className="weather-warning" role="status">Showing saved weather. Live updates are temporarily unavailable.</p>}
        {report && <div className="weather-current">
          <div className="weather-hero">
            <p className="eyebrow">Right now</p>
            <WeatherConditionIcon code={report.current.code} />
            <strong>{value(report.current.temperature, units.temperature)}</strong>
            <p>{weatherDescription(report.current.code)}</p>
          </div>
          <dl className="weather-metrics">
            <div><dt>Wind speed</dt><dd>{value(report.current.windSpeed, units.windSpeed)}</dd></div>
            {report.current.details?.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{value(detail.value, detail.unit)}</dd></div>)}
          </dl>
        </div>}
        {hours.length > 0 && <>
          <div className="outlook-heading">
            <h3 id="hourly-title">Hourly Outlook</h3>
            <div className="outlook-navigation">
              <button aria-label="Previous forecast hours" onClick={() => hourlyOutlook.current?.scrollBy({ left: -hourlyOutlook.current.clientWidth })}>‹</button>
              <button aria-label="Next forecast hours" onClick={() => hourlyOutlook.current?.scrollBy({ left: hourlyOutlook.current.clientWidth })}>›</button>
            </div>
          </div>
          <div className="outlook-chart">
            <div className="outlook-axis" aria-hidden="true">
              <span className="outlook-unit">{units.temperature}</span>
              <div className="temperature-axis">{hourlyScale.ticks.map((tick) => <span key={tick} style={{ top: `${hourlyPosition(tick)}%` }}>{tick}°</span>)}</div>
              <span className="wind-axis">Wind<small>{units.windSpeed}</small></span>
            </div>
            <div className="outlook-scroll" ref={hourlyOutlook} role="region" aria-labelledby="hourly-title" aria-describedby="hourly-help" tabIndex={0}>
              {hours.map((hour) => {
                const strength = windStrength(hour.windSpeed, units.windSpeed);
                return <div key={hour.time} className="outlook-day" role="img" aria-label={`${hour.time.replace("T", " ")}: ${weatherDescription(hour.code)}. ${value(hour.temperature, units.temperature)}. Wind ${value(hour.windSpeed, units.windSpeed)}.`}>
                  <span className="temperature-plot" aria-hidden="true">
                    {hourlyScale.ticks.map((tick) => <span className="temperature-gridline" key={tick} style={{ top: `${hourlyPosition(tick)}%` }} />)}
                    <span className="hourly-temperature" style={{ top: `${hourlyPosition(hour.temperature)}%` }}><b>{Math.round(hour.temperature)}°</b></span>
                  </span>
                  <span className="outlook-date">{hour.time.slice(11, 16)}<small>{hour.time.slice(5, 10)}</small></span>
                  <WeatherConditionIcon code={hour.code} />
                  <span className="wind-cell" style={strength === undefined ? undefined : { background: `color-mix(in srgb, #5589aa ${strength * 100}%, #e6efe1)`, color: strength > .75 ? "#fff" : "#243348" }}>{Number.isFinite(hour.windSpeed) ? Math.round(hour.windSpeed!) : "—"}</span>
                </div>;
              })}
            </div>
          </div>
          <p id="hourly-help" className="weather-meta">Swipe or scroll for more hours. Times shown in {report?.timezone || "local time"}.</p>
        </>}
        <div className="outlook-heading">
          <h3 id="outlook-title">Daily outlook</h3>
          <div className="outlook-navigation">
            <button aria-label="Previous forecast days" onClick={() => outlook.current?.scrollBy({ left: -outlook.current.clientWidth })}>‹</button>
            <button aria-label="Next forecast days" onClick={() => outlook.current?.scrollBy({ left: outlook.current.clientWidth })}>›</button>
          </div>
        </div>
        {days.length ? <div className="outlook-chart">
          <div className="outlook-axis" aria-hidden="true">
            <span className="outlook-unit">{units.temperature}</span>
            <div className="temperature-axis">{scale.ticks.map((tick) => <span key={tick} style={{ top: `${position(tick)}%` }}>{tick}°</span>)}</div>
            <span className="wind-axis">Wind<small>Max · {units.windSpeed}</small></span>
          </div>
          <div className="outlook-scroll" ref={outlook} role="region" aria-labelledby="outlook-title" aria-describedby="outlook-help" tabIndex={0}>
            {days.map((day) => {
              const date = new Date(`${day.date}T12:00:00`);
              const strength = windStrength(day.windMax, units.windSpeed);
              const hasTemperature = Number.isFinite(day.high) && Number.isFinite(day.low) && day.high >= day.low;
              return <div key={day.date} className={`outlook-day ${day.date === todayKey ? "is-today" : ""}`} role="img" aria-label={`${longDate.format(date)}: ${weatherDescription(day.code)}. High ${value(day.high, units.temperature)}, low ${value(day.low, units.temperature)}. Maximum wind ${value(day.windMax, units.windSpeed)}.`}>
                <span className="temperature-plot" aria-hidden="true">
                  {scale.ticks.map((tick) => <span className="temperature-gridline" key={tick} style={{ top: `${position(tick)}%` }} />)}
                  {hasTemperature ? <span className="temperature-range" style={{ top: `${position(day.high)}%`, height: `${(day.high - day.low) / (scale.max - scale.min) * 100}%` }}><b>{Math.round(day.high)}°</b><span>{Math.round(day.low)}°</span></span> : <span className="temperature-missing">—</span>}
                </span>
                <span className="outlook-date">{day.date === todayKey ? "Today" : dayName.format(date)} · {date.getDate()}</span>
                <WeatherConditionIcon code={day.code} />
                <span className="wind-cell" style={strength === undefined ? undefined : { background: `color-mix(in srgb, #5589aa ${strength * 100}%, #e6efe1)`, color: strength > .75 ? "#fff" : "#243348" }}>{Number.isFinite(day.windMax) ? Math.round(day.windMax!) : "—"}</span>
              </div>;
            })}
          </div>
        </div> : <p className="weather-meta">No upcoming forecast is available.</p>}
        <p id="outlook-help" className="weather-meta">Swipe or scroll for more days.</p>
      </div>
    </dialog>
  );
}

function Notes({ onClose, lists, error, reconnect, apiUrl, connected, refresh }: { onClose: () => void; lists: NoteList[]; error?: string; reconnect: () => void; apiUrl: string; connected: boolean; refresh: number }) {
  const tabs = [...lists, { id: "countdowns", label: "Countdowns" }].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  const [listId, setListId] = useState(tabs[0].id);
  const list = lists.find((entry) => entry.id === listId) ?? lists[0];
  const activeId = listId === "countdowns" ? listId : list.id;
  const swipe = useRef<[number, number] | undefined>(undefined);
  const swiped = useRef(false);

  return (
    <aside className="notes" onPointerDown={(event) => {
      swiped.current = false;
      swipe.current = event.isPrimary && event.button === 0 ? [event.clientX, event.clientY] : undefined;
    }} onPointerCancel={() => { swipe.current = undefined; }} onPointerUp={(event) => {
      const start = swipe.current;
      swipe.current = undefined;
      if (!start) return;
      const direction = swipeDirection(event.clientX - start[0], event.clientY - start[1]);
      if (!direction) return;
      swiped.current = true;
      const index = tabs.findIndex((entry) => entry.id === activeId);
      setListId(tabs[Math.max(0, Math.min(tabs.length - 1, index + direction))].id);
    }} onClickCapture={(event) => {
      if (swiped.current) {
        event.preventDefault();
        event.stopPropagation();
        swiped.current = false;
      }
    }}>
      <div className="notes-header">
        <div><p className="eyebrow">Family Notes</p><h2>{listId === "countdowns" ? "Countdowns" : list.label}</h2></div>
        <div className="notes-actions">
          <button onClick={onClose} aria-label="Hide Family Notes" data-sound="boop">×</button>
        </div>
      </div>
      <div className="note-tabs" role="radiogroup" aria-label="Notes list">
        {tabs.map((entry) => <label key={entry.id} title={entry.label}>
          <input type="radio" name="notes-list" aria-label={entry.label} checked={entry.id === activeId} onChange={() => setListId(entry.id)} />
          <span aria-hidden="true" />
        </label>)}
      </div>
      {listId === "countdowns" ? <Countdowns apiUrl={apiUrl} connected={connected} refresh={refresh} /> : <>
      {error && <p className="tasks-warning" role="status" title={error}>Live tasks unavailable. <button onClick={reconnect}>Reconnect Google</button></p>}
      <div className="note-list" key={list.id}>
        {list.items.map((note) => <label key={note.id}><input type="checkbox" /><span>{note.title}</span></label>)}
        {!list.items.length && <p>No open tasks.</p>}
      </div>
      </>}
    </aside>
  );
}

function useTheme(mode: ThemeMode, forecast: Map<string, DayWeather>, idle: boolean): ThemeName {
  const [theme, setTheme] = useState<ThemeName>("light");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const schedule = scheduleFromSolar(forecast.get(dateKey(now)), envThemeSchedule);
      setTheme(resolveTheme(mode, now, schedule));
    };
    update();
    const timer = window.setInterval(update, 60 * 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [mode, forecast]);
  useEffect(() => {
    document.documentElement.dataset.theme = idle ? "dark" : theme;
  }, [theme, idle]);
  return theme;
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    let interval: number | undefined;
    const first = window.setTimeout(() => {
      update();
      interval = window.setInterval(update, 60 * 1000);
    }, Math.max(1, (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds()));
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(first);
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}


function App() {
  useButtonSounds();
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent>();
  const [openDay, setOpenDay] = useState<Date>();
  const [idle, setIdle] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [taskLists, setTaskLists] = useState(noteLists);
  const [tasksError, setTasksError] = useState<string>();
  const [countdownRefresh, setCountdownRefresh] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState(fakeEvents);
  const [forecast, setForecast] = useState(() => fakeForecast(new Date()));
  const [weatherNow, setWeatherNow] = useState<WeatherReport>();
  const [weatherOpen, setWeatherOpen] = useState(false);
  const theme = useTheme(themeMode, forecast, idle);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ state: "idle" | "syncing" | "ok" | "error"; message?: string }>({ state: "idle" });
  const calendarLoadId = useRef(0);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<[number, number] | undefined>(undefined);
  const now = useNow();
  const today = now;
  const dayKey = dateKey(now);
  const background = backgroundDisabled ? undefined : backgroundOverrides[theme] ?? (skin === "default" ? backgroundFor(theme, now) : undefined);
  useEffect(() => {
    if (background) document.documentElement.style.setProperty("--bg-image", `url("${background}")`);
    else document.documentElement.style.removeProperty("--bg-image");
    const nextTheme: ThemeName = theme === "light" ? "dark" : "light";
    const nextImage = backgroundOverrides[nextTheme] ?? (skin === "default" ? backgroundFor(nextTheme, now) : undefined);
    if (nextImage) new Image().src = nextImage;
  }, [theme, dayKey, background]);
  const dates = viewDates(anchor, mode);
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

  const openSettings = () => {
    setSettingsOpen(true);
    settingsDialog.current?.showModal();
  };

  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("photos") !== "settings") return;
    openSettings();
    url.searchParams.delete("photos");
    history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (idle || sleeping) return;
    const enterPhotos = () => { if (!document.querySelector("dialog[open]")) setIdle(true); };
    let timer = window.setTimeout(enterPhotos, 5 * 60 * 1000);
    const wake = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(enterPhotos, 5 * 60 * 1000);
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [idle, sleeping]);

  useEffect(() => {
    fetch(`${apiUrl}/api/auth/status`).then((response) => response.json()).then(({ connected }) => setConnected(connected)).catch(() => setSyncStatus({ state: "error", message: "Calendar API offline" }));
  }, [apiUrl]);

  useEffect(() => {
    let warned = false;
    const load = () => loadWeather(apiUrl).then((report) => {
      setForecast(new Map(report.days.map((day) => [day.date, day])));
      setWeatherNow(report);
    }).catch((error: Error) => {
      setWeatherNow((previous) => previous ? { ...previous, stale: true } : previous);
      if (!warned) {
        console.warn("Weather unavailable:", error.message);
        warned = true;
      }
    });
    load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [apiUrl]);

  const loadCalendar = (force = false) => {
    const loadId = ++calendarLoadId.current;
    const range = viewDates(anchor, mode);
    const syncingTimer = window.setTimeout(() => calendarLoadId.current === loadId && setSyncStatus({ state: "syncing" }), 300);
    loadGoogleEvents(range[0], addDays(range.at(-1)!, 1), new Date(), scheduleRange, force).then((loaded) => {
      if (calendarLoadId.current === loadId) {
        setCalendarEvents(loaded);
        setSyncStatus({ state: "ok" });
      }
    }).catch((error: Error) => calendarLoadId.current === loadId && setSyncStatus({ state: "error", message: error.message })).finally(() => window.clearTimeout(syncingTimer));
    return () => {
      if (calendarLoadId.current === loadId) calendarLoadId.current++;
      window.clearTimeout(syncingTimer);
    };
  };

  useEffect(() => {
    if (!connected) return;
    return loadCalendar();
  }, [connected, anchor, mode]);

  const connectGoogle = () => {
    window.location.assign(`${apiUrl}/api/auth/start?returnTo=${encodeURIComponent(location.origin)}`);
  };

  const loadTasks = (force = false) => fetch(`${apiUrl}/api/tasks${force ? "?force=true" : ""}`).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Tasks API returned ${response.status}`);
    if (!data.length) throw new Error("No matching Google Tasks lists");
    setTaskLists(data);
    setTasksError(undefined);
  }).catch((error: Error) => setTasksError(error.message));

  useEffect(() => {
    if (!connected) return;
    void loadTasks();
    const timer = window.setInterval(loadTasks, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [connected, apiUrl]);

  const syncGoogle = () => {
    setCountdownRefresh((value) => value + 1);
    loadCalendar(true);
    void loadTasks(true);
  };

  const startSwipe = (event: React.TouchEvent) => {
    swipeStart.current = event.touches.length === 1 ? [event.touches[0].clientX, event.touches[0].clientY] : undefined;
  };

  const finishSwipe = (event: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = undefined;
    if (!start || event.changedTouches.length !== 1) return;
    const direction = swipeDirection(event.changedTouches[0].clientX - start[0], event.changedTouches[0].clientY - start[1]);
    if (!direction) return;
    event.preventDefault();
    setAnchor((date) => moveAnchor(date, mode, direction));
  };

  if (sleeping) return <button autoFocus className="sleep-screen" aria-label="Wake display" onClick={() => setSleeping(false)} />;
  if (idle) return <PhotoMode apiUrl={apiUrl} now={today} weather={weatherNow} coldThreshold={coldThreshold} onExit={() => setIdle(false)} />;

  const title = viewTitle(dates, mode, anchor);
  const todayWeather = forecast.get(dateKey(today));
  const currentWeather = weatherNow ? { date: dayKey, code: weatherNow.current.code, high: weatherNow.current.temperature, low: weatherNow.current.temperature } : todayWeather;
  const googleStatus = connected
    ? syncStatus.state === "syncing" ? "Google Calendar connected; syncing" : syncStatus.state === "error" ? `Google Calendar connected; sync error: ${syncStatus.message}; press to retry` : "Google Calendar connected; press to sync"
    : syncStatus.state === "error" ? `Google Calendar disconnected: ${syncStatus.message}` : "Google Calendar disconnected; press to connect";

  return (
    <main>
      <header>
        <div><p className="eyebrow">Family calendar</p><h1>{title}</h1></div>
        <div className="mode-picker" role="group" aria-label="Calendar view">
          {modes.map((item) => <button className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} key={item.id}>{item.label}</button>)}
        </div>
        <button className="weather" aria-label="Open weather details" aria-haspopup="dialog" onClick={() => setWeatherOpen(true)}>
          <DateTime now={now} />
          <span className="weather-icon" data-icon={currentWeather ? weatherIcon(currentWeather, coldThreshold) : "sun"}>{currentWeather ? weatherGlyph(currentWeather, coldThreshold) : "☀"}</span>
          {weatherNow && <span className="weather-stat"><small>Now</small><strong>{Math.round(weatherNow.current.temperature)}°</strong></span>}
          <span className="weather-stat"><small>High</small><strong>{Math.round(forecast.get(dateKey(today))?.high ?? 16)}°</strong></span>
          <span className="weather-stat"><small>Wind high</small><strong>{Math.round(forecast.get(dateKey(today))?.windMax ?? 13)} <em>{weatherNow?.units.windSpeed ?? "kt"}</em></strong></span>
        </button>
        <nav aria-label="Calendar navigation">
          <button onClick={() => setAnchor((date) => moveAnchor(date, mode, -1))} aria-label="Previous" data-sound="boop">‹</button>
          <button className="word-button" onClick={() => setAnchor(new Date())}>Today</button>
          <button onClick={() => setAnchor((date) => moveAnchor(date, mode, 1))} aria-label="Next">›</button>
          <button className="icon-button dark" aria-label="Photos" title="Photos" onClick={() => setIdle(true)}><PhotoIcon /></button>
          {!notesOpen && <button className="icon-button" aria-label="Notes" title="Notes" onClick={() => setNotesOpen(true)}>
            <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
              <rect x="5" y="3" width="22" height="26" rx="2" />
              <path d="m9 10 1.5 1.5 3-3M17 10h6m-14 8 1.5 1.5 3-3M17 18h6M9 25h4m4 0h6" />
            </svg>
          </button>}
        </nav>
      </header>

      <div className={`workspace ${notesOpen ? "" : "notes-hidden"}`}>
        <div className="calendar-pane" onTouchStart={startSwipe} onTouchEnd={finishSwipe} onTouchCancel={() => { swipeStart.current = undefined; }}>
          {mode === "month" ? <Month dates={dates} anchor={anchor} today={today} now={now} events={calendarEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onOpenDay={setOpenDay} /> : mode === "twoWeek" ? <TwoWeek dates={dates} today={today} now={now} events={calendarEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onOpenDay={setOpenDay} /> : <Timeline dates={dates} today={today} now={now} events={calendarEvents} range={scheduleRange} forecast={forecast} focus={mode === "day" ? anchor : undefined} onSelect={setSelected} onOpenDay={setOpenDay} />}
        </div>
        {notesOpen && <Notes onClose={() => setNotesOpen(false)} lists={taskLists} error={tasksError} reconnect={connectGoogle} apiUrl={apiUrl} connected={connected} refresh={countdownRefresh} />}
      </div>

      <nav className="corner-controls" aria-label="Calendar settings">
        <button aria-label="Sleep display" title="Sleep display" onClick={() => setSleeping(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></svg>
        </button>
        <button className="settings-trigger" data-connected={connected} data-syncing={connected && syncStatus.state === "syncing"}
          onClick={openSettings} aria-label="Open settings" title="Settings" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
        </button>
      </nav>

      <dialog ref={settingsDialog} className="settings-dialog" aria-labelledby="settings-title" onClose={() => setSettingsOpen(false)}>
        <div className="settings-heading"><h2 id="settings-title">Settings</h2><button className="close" onClick={() => settingsDialog.current?.close()} aria-label="Close settings">×</button></div>
        <section className="settings-section">
          <h3>Google Calendar</h3>
          <p className="settings-status" data-state={connected ? syncStatus.state : "error"}>{googleStatus}</p>
          <div className="settings-actions">
            <button onClick={connected ? syncGoogle : connectGoogle}>{connected ? "Sync now" : "Connect Google"}</button>
          </div>
        </section>
        <PhotoSettings apiUrl={apiUrl} open={settingsOpen} />
        <ApplicationUpdates apiUrl={apiUrl} open={settingsOpen} />
        <div className="settings-footer"><button onClick={() => settingsDialog.current?.close()}>Close</button></div>
      </dialog>

      {skin === "woodland" && <DogCompanion apiUrl={apiUrl} />}
      {skin === "woodland" && <WoodlandBackground />}

      {weatherOpen && <WeatherModal report={weatherNow} forecast={forecast} onClose={() => setWeatherOpen(false)} />}

      {openDay && <DayModal date={openDay} today={today} now={now} events={calendarEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onClose={() => setOpenDay(undefined)} />}

      {selected && <div className="backdrop event-backdrop" onClick={() => setSelected(undefined)}><section className="event-detail" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(undefined)} aria-label="Close" data-sound="boop">×</button><span className={`badge ${selected.tone}`}>{selected.person}</span><h2 id="event-title">{selected.title}</h2><p>{eventTime(selected)}</p><p>{selected.detail}</p></section></div>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
