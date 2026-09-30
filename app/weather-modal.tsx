import { useRef } from "react";
import { Modal } from "./modal";
import { useNow } from "./date-time";
import { dayName, longDate } from "./calendar-views";
import { dateKey, upcomingHours, weatherChartScale, weatherDescription, weatherIcon, windStrength, type DayWeather, type WeatherReport } from "./weather";

function WeatherConditionIcon({ code }: { code: number }) {
  const icon = weatherIcon({ date: "", code, high: 1, low: 1 }, -Infinity);
  const sunny = icon === "sun" || icon === "partly";
  return <svg className="condition-icon" data-icon={icon} viewBox="0 0 80 80" role="img" aria-label={weatherDescription(code)}>
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

export function WeatherModal({ report, forecast, onClose }: { report?: WeatherReport; forecast: Map<string, DayWeather>; onClose: () => void }) {
  const outlook = useRef<HTMLDivElement>(null);
  const hourlyOutlook = useRef<HTMLDivElement>(null);
  const hours = upcomingHours(report, useNow());
  const hourlyScale = weatherChartScale(hours.map((hour) => ({ high: hour.temperature, low: hour.temperature })));
  const hourlyPosition = (temperature: number) => (hourlyScale.max - temperature) / (hourlyScale.max - hourlyScale.min) * 100;
  const todayKey = report?.timezone ? new Intl.DateTimeFormat("en-CA", { timeZone: report.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) : dateKey(new Date());
  const units = report?.units ?? { temperature: "°C", windSpeed: "kt" };
  const days = Array.from(forecast.values()).filter((day) => day.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date));
  const scale = weatherChartScale(days);
  const position = (temperature: number) => (scale.max - temperature) / (scale.max - scale.min) * 100;
  const value = (number: number | undefined, unit = "") => Number.isFinite(number) ? `${Number(number!.toFixed(1))} ${unit}`.trim() : "Unavailable";
  return (
    <Modal className="weather-modal" aria-labelledby="weather-title" onClose={onClose}>
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
    </Modal>
  );
}
