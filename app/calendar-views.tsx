import React, { useEffect, useState } from "react";
import { addDays } from "./dates";
import { moonPhaseOn } from "./moon";
import { dayDifference, layoutEventColumns, layoutEvents, orderEvents, upcomingEvents, type AgendaCalendar, type CalendarEvent } from "./google-calendar";
import { formatHour, hourLabels, hourOf, hourOffset, placeRows, scheduleHours, timeMarkerOffset, titleLines, type ScheduleRange } from "./schedule";
import { dateKey, weatherGlyph, weatherIcon, type DayWeather } from "./weather";

export const coldThreshold = Number(import.meta.env.VITE_WEATHER_COLD_THRESHOLD ?? 0);
export const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short" });
export const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const agendaDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

const dayTap = (onOpenDay: (date: Date) => void, date: Date) => (event: React.MouseEvent) => {
  if ((event.target as Element).closest("button")) return;
  onOpenDay(date);
};


function sameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

function isPastEvent(date: Date, now: Date, start: number, duration: number) {
  return sameDay(date, now) ? start + duration <= hourOf(now) : date < now;
}

function eventTime(event: CalendarEvent) {
  if (event.timeLabel) return event.timeLabel;
  if (event.allDay) return "All day";
  const date = new Date(2000, 0, 1, Math.floor(event.start), (event.start % 1) * 60);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function eventTimeSpan(event: CalendarEvent) {
  return event.allDay ? "All day" : `${eventTime(event)} – ${event.endLabel ?? formatHour(event.start + event.duration)}`;
}

export function eventTitle(event: CalendarEvent) {
  return <>{event.collection && <span className="collection-icon" aria-hidden="true">{event.collection === "garbage" ? "🗑️" : "♻️"}</span>}{event.title}</>;
}

function eventsFor(events: CalendarEvent[], date: Date, today: Date) {
  return orderEvents(events.filter((event) => sameDay(date, addDays(today, event.day))));
}

function AgendaColumn({ calendar, now, onSelect }: { calendar: AgendaCalendar; now: Date; onSelect: (event: CalendarEvent) => void }) {
  const [capacityRef, capacity] = useRowCapacity("--agenda-row", "--agenda-gap");
  const items = upcomingEvents(calendar.events, hourOf(now)).slice(0, capacity);
  const days = [...new Set(items.map((event) => event.day))];
  return <article className={`agenda-person ${calendar.tone}`}>
    <h3><span className="agenda-avatar" aria-hidden="true">{calendar.name.slice(0, 1).toUpperCase()}</span>{calendar.name}</h3>
    <div className="agenda-events" ref={capacityRef}>
      {items.length ? items.map((event, index) => <button className={`agenda-event ${days.indexOf(event.day) % 2 ? "alternate-day" : ""}`} onClick={() => onSelect(event)} key={`${event.day}-${event.start}-${event.title}-${index}`}>
        <span className="agenda-when">{event.day === 0 ? "Today" : event.day === 1 ? "Tomorrow" : agendaDate.format(addDays(now, event.day))} · {eventTime(event)}</span>
        <strong>{eventTitle(event)}</strong>
        {event.detail && <small>{event.detail}</small>}
      </button>) : <p className="agenda-empty">A clear trail ahead</p>}
    </div>
  </article>;
}

export function WhatsNext({ calendars, now, onSelect }: { calendars: AgendaCalendar[]; now: Date; onSelect: (event: CalendarEvent) => void }) {
  return <section className="whats-next" aria-label="What's next by calendar">
    <div className="agenda-grid" style={{ "--agenda-columns": Math.max(1, calendars.length) } as React.CSSProperties}>
      {calendars.map((calendar) => <AgendaColumn calendar={calendar} now={now} onSelect={onSelect} key={calendar.id} />)}
    </div>
  </section>;
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

export function Timeline({ dates, today, now, events, range, focus, forecast, onSelect, onOpenDay }: { dates: Date[]; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; focus?: Date; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
  const nowHour = hourOf(now);
  const sideBySide = Boolean(focus) || dates.length === 1;
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
        const timedEvents = dayEvents.filter((event) => !event.allDay);
        const laidOut = sideBySide ? layoutEventColumns(timedEvents, range) : layoutEvents(timedEvents, 1, range).map((item) => ({ ...item, column: 0, columns: 1 }));
        const nowOffset = sameDay(date, now) ? timeMarkerOffset(nowHour, sideBySide ? [] : laidOut, range) : null;
        return (
          <div className={`day-column ${sameDay(date, today) ? "today" : ""} ${focus ? (sameDay(date, focus) ? "focus" : "context") : ""}`} key={date.toDateString()} onClick={dayTap(onOpenDay, date)} aria-label={`Open ${longDate.format(date)}`}>
            <div className="all-day-lane">
              {dayEvents.filter((event) => event.allDay).map((event) => <button className={`all-day ${event.tone} ${dayDifference(date, today) < 0 ? "past" : ""}`} onClick={() => onSelect(event)} key={event.title}>{eventTitle(event)}</button>)}
            </div>
            <div className="hours" style={{ "--schedule-hours": scheduleHours(range) } as React.CSSProperties}>
              {nowOffset !== null && <div className="now-line" style={{ top: `${nowOffset * 100}%` }} aria-hidden />}
              {laidOut.map(({ event, start, duration, column, columns }) => (
                <button
                  className={`timed-event ${event.tone} ${isPastEvent(date, now, event.start, event.duration) ? "past" : ""}`}
                  style={{ top: `${hourOffset(range, start) * 100}%`, height: `calc(${(duration / scheduleHours(range)) * 100}% - 1px)`, left: `calc(${column / columns * 100}% + .2rem)`, width: `calc(${100 / columns}% - .4rem)`, "--title-lines": titleLines(duration, 0.75 * scheduleHours(range) / 12, 3) } as React.CSSProperties}
                  onClick={() => onSelect(event)}
                  key={`${event.start}-${event.title}`}
                >
                  <span className="event-body"><span>{eventTime(event)}</span><strong>{event.title}</strong></span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function useRowCapacity(rowProperty = "--month-row", gapProperty = "--month-gap") {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [capacity, setCapacity] = useState(3);
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const styles = getComputedStyle(element);
      const row = (parseFloat(styles.getPropertyValue(rowProperty)) || 1.4) * rem;
      const gap = (parseFloat(styles.getPropertyValue(gapProperty)) || 0.15) * rem;
      setCapacity(Math.max(1, Math.floor((element.clientHeight + gap) / (row + gap))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rowProperty, gapProperty]);
  return [setElement, capacity] as const;
}

export function Month({ dates, anchor, today, now, events, range, forecast, onSelect, onOpenDay }: { dates: Date[]; anchor: Date; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
  const [capacityRef, capacity] = useRowCapacity();
  const hours = scheduleHours(range);
  return (
    <section className="month-grid">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong className="month-heading" key={day}>{day}</strong>)}
      {dates.map((date, index) => {
        const dayEvents = eventsFor(events, date, today);
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
                {dayEvents.map((event, row) => <button className={`${event.tone} ${(event.allDay ? dayDifference(date, today) < 0 : isPastEvent(date, now, event.start, event.duration)) ? "past" : ""}`} style={{ top: `${tops[row] * 100}%` }} onClick={() => onSelect(event)} key={`${event.start}-${event.title}`} aria-label={`${eventTime(event)} ${event.title}`}>{eventTitle(event)}</button>)}
              </div>
            </div>
          );
        }
        const visible = dayEvents.slice(0, Math.max(1, capacity - 1));
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
                  <button className={`${event.tone} ${(event.allDay ? dayDifference(date, today) < 0 : isPastEvent(date, now, event.start, event.duration)) ? "past" : ""}`} onClick={() => onSelect(event)} aria-label={`${eventTime(event)} ${event.title}`}>{eventTitle(event)}</button>
                </React.Fragment>
              ))}
              {showRule && !upcoming && <div className="now-rule" aria-hidden />}
              {capacity > 1 && <button className="more" onClick={() => onOpenDay(date)}>⌄ {dayEvents.length - visible.length} more</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function TwoWeek({ dates, today, now, events, range, forecast, onSelect, onOpenDay }: { dates: Date[]; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onOpenDay: (date: Date) => void }) {
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
              {dayEvents.filter((event) => event.allDay).map((event) => <button className={`${event.tone} ${dayDifference(date, today) < 0 ? "past" : ""}`} onClick={() => onSelect(event)} key={event.title}>{eventTitle(event)}</button>)}
            </div>
            <div className="mini-hours" style={{ "--schedule-hours": scheduleHours(range) } as React.CSSProperties}>
              {nowOffset !== null && <div className="now-line mini" style={{ top: `${nowOffset * 100}%` }} aria-hidden />}
              {laidOut.map(({ event, start, duration }) => (
                <button className={`${event.tone} ${isPastEvent(date, now, event.start, event.duration) ? "past" : ""}`} style={{ top: `${hourOffset(range, start) * 100}%`, height: `calc(${(duration / scheduleHours(range)) * 100}% - 1px)`, "--title-lines": titleLines(duration, 0.75 * scheduleHours(range) / 12, 2) } as React.CSSProperties} onClick={() => onSelect(event)} key={`${event.start}-${event.title}`}>
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

export function DayModal({ date, today, now, events, range, forecast, onSelect, onClose }: { date: Date; today: Date; now: Date; events: CalendarEvent[]; range: ScheduleRange; forecast: Map<string, DayWeather>; onSelect: (event: CalendarEvent) => void; onClose: () => void }) {
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
