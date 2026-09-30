import { useEffect, useState } from "react";

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function DateTime({ now }: { now: Date }) {
  return <time className="date-time" dateTime={now.toISOString()}>
    <span className="date-time-date">{dateFormat.format(now)}</span>
    <strong className="date-time-clock">{timeFormat.formatToParts(now).map((part, index) => part.type === "dayPeriod" ? <small key={index}>{part.value}</small> : part.value)}</strong>
  </time>;
}

export function useNow(): Date {
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
