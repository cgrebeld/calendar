const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function DateTime({ now }: { now: Date }) {
  return <time className="date-time" dateTime={now.toISOString()}>
    <span className="date-time-date">{dateFormat.format(now)}</span>
    <strong className="date-time-clock">{timeFormat.formatToParts(now).map((part, index) => part.type === "dayPeriod" ? <small key={index}>{part.value}</small> : part.value)}</strong>
  </time>;
}
