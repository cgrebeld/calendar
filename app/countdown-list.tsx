import { useEffect, useState } from "react";
import { countdownItems, countdownRange } from "./countdowns";
import { holidayCountdowns, schoolCountdowns } from "./holidays";

export function Countdowns({ apiUrl, connected, refresh }: { apiUrl: string; connected: boolean; refresh: number }) {
  const [items, setItems] = useState<ReturnType<typeof countdownItems>>([]);
  const [status, setStatus] = useState("Loading countdowns…");
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    let firstLoad = true;
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      const today = new Date();
      const { from, to } = countdownRange(today);
      const query = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString() });
      if (refresh && firstLoad) query.set("force", "true");
      firstLoad = false;
      try {
        const response = await fetch(`${apiUrl}/api/calendar/countdowns?${query}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error("Calendar countdowns unavailable. Press sync to retry.");
        const entries = countdownItems(await response.json(), today);
        if (controller.signal.aborted) return;
        setItems(entries);
        setStatus("");
      } catch (error) {
        if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Calendar countdowns unavailable.");
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    const wake = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", wake);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [apiUrl, connected, refresh]);
  const combined = [...(connected ? items : []), ...holidayCountdowns(today), ...schoolCountdowns(today)]
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const seen = new Set<string>();
  return <div className="note-list">
    {connected && status && <p role="status">{status}</p>}
    {combined.filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item) => <div className="countdown-note" key={item.id}>{item.title}</div>)}
  </div>;
}
