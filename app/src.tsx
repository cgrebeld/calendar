import { reportError, installErrorReporting } from "./client-log";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { addDays, moveAnchor, swipeDirection, viewDates, viewTitle, type ViewMode } from "./dates";
import { agendaColumns, dayDifference, loadGoogleAgenda, loadGoogleEvents, type AgendaCalendar, type CalendarEvent } from "./google-calendar";
import { hourOf, scheduleRangeFromEnv } from "./schedule";
import { dateKey, fakeForecast, loadWeather, weatherGlyph, weatherIcon, type DayWeather, type WeatherReport } from "./weather";
import { backgroundFor, parseSkin, parseThemeMode, parseThemeSchedule, resolveTheme, scheduleFromSolar, type ThemeMode, type ThemeName } from "./theme";
import "./style.css";
import { WoodlandBackground } from "./skins/woodland";
import { DateTime, useNow } from "./date-time";
import { coldThreshold, DayModal, eventTimeSpan, eventTitle, Month, Timeline, TwoWeek, WhatsNext } from "./calendar-views";
import { WeatherModal } from "./weather-modal";
import { Modal } from "./modal";
import { DogCompanion } from "./dog";
import { ChoreQuests, pets } from "./chore-quests";
import { personalViews, weeklyQuests, weekOf, newlyCompleted, type NoteList, type Quest } from "./quests";
import { Countdowns } from "./countdown-list";
import { ApplicationUpdates } from "./updates";
import { PhotoIcon, PhotoMode, PhotoSettings } from "./photos";
import { connectGoogle as openGoogle, googlePopupId, finishGooglePopup } from "./google-connect";

installErrorReporting(import.meta.env.VITE_API_URL ?? "http://localhost:3000");

const themeMode = parseThemeMode(new URLSearchParams(location.search).get("theme") ?? import.meta.env.VITE_THEME_MODE);
function savedSkin() {
  try { return localStorage.getItem("skin"); } catch { return null; }
}
const initialSkin = parseSkin(new URLSearchParams(location.search).get("skin") ?? savedSkin() ?? import.meta.env.VITE_SKIN);
document.documentElement.dataset.skin = initialSkin;
const envThemeSchedule = parseThemeSchedule(import.meta.env.VITE_THEME_LIGHT_START, import.meta.env.VITE_THEME_DARK_START);

const scheduleRange = scheduleRangeFromEnv();
const backgroundDisabled = import.meta.env.VITE_BACKGROUND === "none";
const backgroundOverrides: Record<ThemeName, string | undefined> = {
  light: import.meta.env.VITE_BACKGROUND_LIGHT,
  dark: import.meta.env.VITE_BACKGROUND_DARK,
};

const demoEvents: Omit<CalendarEvent, "id">[] = [
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
const fakeEvents: CalendarEvent[] = demoEvents.map((event, index) => ({ ...event, id: `demo-${index}` }));

const people = personalViews(import.meta.env.VITE_PERSONAL_VIEWS ?? "Ada:Ada,Ada School");
const petImage = (name: string) => `url(/characters/${pets.get(name.toLowerCase()) ?? "dragon"}.png)`;

const modes: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "twoWeek", label: "2 weeks" },
  { id: "month", label: "Month" },
];

function CalendarModeIcon({ mode }: { mode: ViewMode | "agenda" }) {
  const marks = {
    day: "M13 17l3-2v11m-3 0h6",
    week: "M7 16v10m4-10v10m4-10v10m4-10v10m4-10v10",
    twoWeek: "M7 16v3m4-3v3m4-3v3m4-3v3m4-3v3M7 23v3m4-3v3m4-3v3m4-3v3m4-3v3",
    month: "M7 16h1m5 0h1m5 0h1m5 0h1M7 21h1m5 0h1m5 0h1m5 0h1M7 26h1m5 0h1m5 0h1m5 0h1",
    agenda: "M7 16h1m-1 5h1m-1 5h1M13 16h12m-12 5h12m-12 5h12",
  };
  return <svg className="calendar-mode-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
    <rect className="calendar-icon-shell" x="3" y="6" width="26" height="24" rx="4" />
    <path className="calendar-icon-header" d="M4 7h24v5H4z" stroke="none" />
    <path d="M3 12h26M9 3v5M23 3v5" />
    <path className="calendar-icon-marks" d={marks[mode]} />
  </svg>;
}

const noteLists: NoteList[] = [
  { id: "reminders", label: "Reminders", items: ["Pick up dry cleaning", "Order Maya’s school photos", "Replace hallway light bulb", "Call Grandma this weekend"].map((title, id) => ({ id: `reminder-${id}`, title })) },
  { id: "groceries", label: "Groceries", items: ["Milk", "Bananas", "Coffee beans", "Dish soap", "Cheddar"].map((title, id) => ({ id: `grocery-${id}`, title })) },
];
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

function Notes({ onClose, onCelebrate, quests, now, lists, error, reconnect, apiUrl, connected, refresh }: { onClose: () => void; onCelebrate: (name: string) => void; quests: Quest[]; now: Date; lists: NoteList[]; error?: string; reconnect: () => void; apiUrl: string; connected: boolean; refresh: number }) {
  const tabs = [...lists, { id: "countdowns", label: "Countdowns" }].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  const [listId, setListId] = useState(tabs[0].id);
  const list = lists.find((entry) => entry.id === listId) ?? lists[0];
  const activeId = listId === "countdowns" ? listId : list.id;
  const chores = listId !== "countdowns" && list.label.toLowerCase() === "chores";
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
        <div><p className="eyebrow">{chores ? "Family Adventures" : "Family Notes"}</p><h2>{chores ? "Chore Quests" : listId === "countdowns" ? "Countdowns" : list.label}</h2></div>
        <div className="notes-actions">
          <button onClick={onClose} aria-label="Hide Family Notes" data-sound="boop"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="m3 3 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button>
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
      {chores ? <ChoreQuests quests={quests} now={now} onCelebrate={onCelebrate} /> : <div className="note-list" key={list.id}>
        {list.items.map(note => <label key={note.id}>
          <input type="checkbox" checked={note.completed ?? false} disabled /><span>{note.title}</span>
        </label>)}
        {!list.items.length && <p>No tasks.</p>}
        <p className="quest-help">Managed in Google Tasks.</p>
      </div>}
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


function App() {
  useButtonSounds();
  const [skin, setSkin] = useState(initialSkin);
  useEffect(() => { document.documentElement.dataset.skin = skin; }, [skin]);
  const [familyMode, setMode] = useState<ViewMode>("week");
  const [person, setPerson] = useState<string>();
  // A personal page is the 3-day view of that person's calendars only.
  const personCalendars = people.find((entry) => entry.name === person)?.calendars;
  const mode = person ? "day" : familyMode;
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent>();
  const [openDay, setOpenDay] = useState<Date>();
  const [idle, setIdle] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  // Photo mode and sleep show no calendar, so its polling pauses and reloads on return.
  const paused = idle || sleeping;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<string>();
  const [notesOpen, setNotesOpen] = useState(false);
  const [taskLists, setTaskLists] = useState(noteLists);
  const [celebration, setCelebration] = useState<{ names: string; id: number }>();
  const previousQuests = useRef<{ week: string; quests: Quest[] }>(undefined);
  const [tasksError, setTasksError] = useState<string>();
  const [countdownRefresh, setCountdownRefresh] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState(fakeEvents);
  const [agendaCalendars, setAgendaCalendars] = useState<AgendaCalendar[]>();
  const [collectionDates, setCollectionDates] = useState<{ date: string; kind: "garbage" | "recycling" }[]>([]);
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
  const quests = weeklyQuests(taskLists.filter(list => list.label.toLowerCase() === "chores").flatMap(list => list.items), now);
  const questWeek = weekOf(now).key;
  useEffect(() => {
    if (!connected || tasksError) return;
    const previous = previousQuests.current;
    const names = previous?.week === questWeek ? newlyCompleted(previous.quests, quests) : [];
    if (names.length) setCelebration({ names: names.join(" & "), id: Date.now() });
    previousQuests.current = { week: questWeek, quests };
  }, [taskLists, questWeek, connected, tasksError]);
  useEffect(() => {
    if (!celebration) return;
    // Clear once played so remounting the dog (e.g. after photo mode) does not replay it.
    const timer = window.setTimeout(() => setCelebration(undefined), 12000);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  const dayKey = dateKey(now);
  const background = backgroundDisabled ? undefined : backgroundOverrides[theme] ?? (skin === "default" ? backgroundFor(theme, now) : undefined);
  useEffect(() => {
    if (background) document.documentElement.style.setProperty("--bg-image", `url("${background}")`);
    else document.documentElement.style.removeProperty("--bg-image");
    const nextTheme: ThemeName = theme === "light" ? "dark" : "light";
    const nextImage = backgroundOverrides[nextTheme] ?? (skin === "default" ? backgroundFor(nextTheme, now) : undefined);
    if (nextImage) new Image().src = nextImage;
  }, [theme, dayKey, background, skin]);
  const dates = viewDates(anchor, mode);
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  const displayEvents: CalendarEvent[] = personCalendars ? calendarEvents.filter((event) => personCalendars.includes(event.person.toLowerCase())) : [...calendarEvents, ...collectionDates.map(({ date, kind }): CalendarEvent => {
    const [year, month, day] = date.split("-").map(Number);
    return { id: `${kind}-${date}`, day: dayDifference(new Date(year, month - 1, day), today), person: kind === "garbage" ? "City of Victoria" : "CRD", tone: "collection", start: scheduleRange.startHour, duration: 1, title: kind === "garbage" ? "Garbage & organics" : "Recycling", detail: kind === "garbage" ? "City of Victoria collection" : "CRD blue box collection", allDay: true, collection: kind };
  })];

  useEffect(() => {
    if (paused) return;
    const load = () => fetch(`${apiUrl}/api/collections`, { signal: AbortSignal.timeout(30000) }).then(async (response) => {
      if (!response.ok) throw new Error(`Collection API returned ${response.status}`);
      const data = await response.json();
      setCollectionDates(data.events);
      if (data.errors.length) reportError(apiUrl, "collections", JSON.stringify(data.errors));
    }).catch((error: Error) => reportError(apiUrl, "collections", error));
    void load();
    const timer = window.setInterval(load, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [apiUrl, paused]);

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
    const enterPhotos = () => { if (!document.querySelector("dialog[open]:not(.day-modal, .event-detail)")) setIdle(true); };
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
    fetch(`${apiUrl}/api/auth/status`, { signal: AbortSignal.timeout(10000) }).then((response) => { if (!response.ok) throw new Error(`Auth status returned ${response.status}`); return response.json(); }).then(({ connected }) => setConnected(connected)).catch((error) => { reportError(apiUrl, "auth status", error); setSyncStatus({ state: "error", message: "Calendar API offline" }); });
  }, [apiUrl]);

  useEffect(() => {
    let warned = false;
    const load = () => loadWeather(apiUrl).then((report) => {
      setForecast(new Map(report.days.map((day) => [day.date, day])));
      setWeatherNow(report);
    }).catch((error: Error) => {
      setWeatherNow((previous) => previous ? { ...previous, stale: true } : previous);
      if (!warned) {
        reportError(apiUrl, "weather", error);
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
    const load = agendaOpen ? loadGoogleAgenda(new Date(), scheduleRange, force) : loadGoogleEvents(range[0], addDays(range.at(-1)!, 1), new Date(), scheduleRange, force, personCalendars);
    load.then((loaded) => {
      if (calendarLoadId.current === loadId) {
        if (agendaOpen) setAgendaCalendars(loaded as AgendaCalendar[]);
        else setCalendarEvents(loaded as CalendarEvent[]);
        setSyncStatus({ state: "ok" });
      }
    }).catch((error: Error) => { reportError(apiUrl, "calendar", error); if (calendarLoadId.current === loadId) setSyncStatus({ state: "error", message: error.message }); }).finally(() => window.clearTimeout(syncingTimer));
    return () => {
      if (calendarLoadId.current === loadId) calendarLoadId.current++;
      window.clearTimeout(syncingTimer);
    };
  };

  useEffect(() => {
    if (!connected || paused) return;
    let cancel = loadCalendar();
    const timer = window.setInterval(() => { cancel = loadCalendar(); }, 5 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      cancel();
    };
  }, [connected, paused, anchor, mode, agendaOpen, person, dayKey]);

  const connectGoogle = () => {
    try { openGoogle(apiUrl); }
    catch (error) {
      setSyncStatus({ state: "error", message: (error as Error).message });
      openSettings();
    }
  };

  const loadTasks = (force = false) => fetch(`${apiUrl}/api/tasks${force ? "?force=true" : ""}`, { signal: AbortSignal.timeout(30000) }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Tasks API returned ${response.status}`);
    if (!data.length) throw new Error("No matching Google Tasks lists");
    setTaskLists(data);
    setTasksError(undefined);
  }).catch((error: Error) => { reportError(apiUrl, "tasks", error); setTasksError(error.message); });

  useEffect(() => {
    if (!connected || paused) return;
    void loadTasks();
    const timer = window.setInterval(loadTasks, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [connected, paused, apiUrl]);

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
    setAgendaOpen(false);
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
        <div><p className="eyebrow">{person && !agendaOpen ? `${person}’s page` : "Family calendar"}</p><h1>{agendaOpen ? "What’s next" : title}</h1></div>
        <div className="mode-picker" role="group" aria-label="Calendar view">
          {modes.map((item) => <button className={!agendaOpen && !person && mode === item.id ? "active" : ""} aria-label={item.label} title={item.label} aria-pressed={!agendaOpen && !person && mode === item.id} onClick={() => { setAgendaOpen(false); setPerson(undefined); setMode(item.id); }} key={item.id}><CalendarModeIcon mode={item.id} /></button>)}
          <button className={agendaOpen ? "active" : ""} aria-label="Agenda" title="Agenda — What’s next" aria-pressed={agendaOpen} onClick={() => { setPerson(undefined); setAgendaOpen(true); }}><CalendarModeIcon mode="agenda" /></button>
          {people.length > 0 && <span className="mode-divider" aria-hidden="true" />}
          {people.map(({ name }) => <button className={!agendaOpen && person === name ? "active" : ""} aria-label={`${name}’s page`} title={`${name}’s page`} aria-pressed={!agendaOpen && person === name} onClick={() => { setAgendaOpen(false); setPerson(name); setAnchor(new Date()); }} key={name}><span className="person-pet" style={{ backgroundImage: petImage(name) }} /></button>)}
        </div>
        <button className="weather" aria-label="Open weather details" aria-haspopup="dialog" onClick={() => setWeatherOpen(true)}>
          <DateTime now={now} />
          <span className="weather-icon" data-icon={currentWeather ? weatherIcon(currentWeather, coldThreshold) : "sun"}>{currentWeather ? weatherGlyph(currentWeather, coldThreshold) : "☀"}</span>
          {weatherNow && <span className="weather-stat"><small>Feels like</small><strong>{Math.round(weatherNow.current.details?.find((detail) => detail.label === "Feels like")?.value ?? weatherNow.current.temperature)}°</strong></span>}
          <span className="weather-stat"><small>High</small><strong>{Math.round(forecast.get(dateKey(today))?.high ?? 16)}°</strong></span>
          <span className="weather-stat"><small>Wind</small><strong>{Math.round(weatherNow?.current.windSpeed ?? forecast.get(dateKey(today))?.windMax ?? 13)} <em>{weatherNow?.units.windSpeed ?? "kt"}</em></strong></span>
        </button>
        <nav aria-label="Calendar navigation">
          <button onClick={() => { setAgendaOpen(false); setAnchor((date) => moveAnchor(date, mode, -1)); }} aria-label="Previous" data-sound="boop">‹</button>
          <button className="word-button" onClick={() => { setAgendaOpen(false); setAnchor(new Date()); }}>Today</button>
          <button onClick={() => { setAgendaOpen(false); setAnchor((date) => moveAnchor(date, mode, 1)); }} aria-label="Next">›</button>
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
        <div className={`calendar-pane ${person && !agendaOpen ? "personal" : ""}`} style={person ? { "--person-pet": petImage(person) } as React.CSSProperties : undefined} onTouchStart={startSwipe} onTouchEnd={finishSwipe} onTouchCancel={() => { swipeStart.current = undefined; }}>
          {agendaOpen ? <WhatsNext calendars={agendaCalendars ?? (connected ? [] : agendaColumns(fakeEvents, hourOf(now)))} now={now} onSelect={setSelected} /> : mode === "month" ? <Month dates={dates} anchor={anchor} today={today} now={now} events={displayEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onOpenDay={setOpenDay} /> : mode === "twoWeek" ? <TwoWeek dates={dates} today={today} now={now} events={displayEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onOpenDay={setOpenDay} /> : <Timeline dates={dates} today={today} now={now} events={displayEvents} range={scheduleRange} forecast={forecast} focus={mode === "day" ? anchor : undefined} onSelect={setSelected} onOpenDay={setOpenDay} />}
        </div>
        {notesOpen && <div className="notes-frame"><Notes onCelebrate={name => setCelebration(previous => ({ names: name, id: (previous?.id ?? 0) + 1 }))} onClose={() => setNotesOpen(false)} quests={quests} now={now} lists={taskLists} error={tasksError} reconnect={connectGoogle} apiUrl={apiUrl} connected={connected} refresh={countdownRefresh} /></div>}
      </div>

      <nav className="corner-controls" aria-label="Calendar settings">
        {availableUpdate && <button className="update-available" onClick={openSettings} aria-label={`Update ${availableUpdate} available. Open settings to install.`}>Update {availableUpdate}</button>}
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
        <div className="settings-heading"><h2 id="settings-title">Settings</h2></div>
        <section className="settings-section">
          <h3>Google Calendar</h3>
          <p className="settings-status" data-state={connected ? syncStatus.state : "error"}>{googleStatus}</p>
          <div className="settings-actions">
            <button onClick={connected ? syncGoogle : connectGoogle}>{connected ? "Sync now" : "Connect Google"}</button>
          </div>
        </section>
        <section className="settings-section">
          <h3>Appearance</h3>
          <label>Skin <select value={skin} onChange={(event) => {
            const next = parseSkin(event.target.value);
            setSkin(next);
            try { localStorage.setItem("skin", next); } catch {}
          }}>
            <option value="default">Modern</option>
            <option value="woodland">Woodland</option>
          </select></label>
        </section>
        <PhotoSettings apiUrl={apiUrl} open={settingsOpen} />
        <ApplicationUpdates apiUrl={apiUrl} onAvailableChange={setAvailableUpdate} />
        <div className="settings-footer"><button onClick={() => settingsDialog.current?.close()}>Close</button></div>
      </dialog>

      {(skin === "woodland" || celebration) && <DogCompanion apiUrl={apiUrl} celebration={celebration} />}
      {skin === "woodland" && <WoodlandBackground />}

      {weatherOpen && <WeatherModal report={weatherNow} forecast={forecast} onClose={() => setWeatherOpen(false)} />}

      {openDay && <DayModal date={openDay} today={today} now={now} events={displayEvents} range={scheduleRange} forecast={forecast} onSelect={setSelected} onClose={() => setOpenDay(undefined)} />}

      {selected && <Modal className="event-detail" aria-labelledby="event-title" onClose={() => setSelected(undefined)}><button className="close" onClick={() => setSelected(undefined)} aria-label="Close" data-sound="boop">×</button><span className={`badge ${selected.tone}`}>{selected.person}</span><h2 id="event-title">{eventTitle(selected)}</h2><p>{eventTimeSpan(selected)}</p>{selected.recurring && <p>Recurring event</p>}<p>{selected.detail}</p></Modal>}
    </main>
  );
}

function GoogleConnected({ id }: { id: string }) {
  useEffect(() => finishGooglePopup(id), [id]);
  return <section style={{ padding: "2rem" }}><h1>Google connected</h1><p>You can close this window and return to the calendar.</p><button onClick={() => window.close()}>Close window</button></section>;
}

const popupId = googlePopupId(location.search);
createRoot(document.getElementById("root")!, { onUncaughtError: (error) => reportError(import.meta.env.VITE_API_URL ?? "http://localhost:3000", "render", error) }).render(<React.StrictMode>{popupId ? <GoogleConnected id={popupId} /> : <App />}</React.StrictMode>);
