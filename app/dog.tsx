import { playBark } from "./dog-audio";
import { reportError } from "./client-log";
import { useEffect, useRef, useState } from "react";
import "./dog.css";

export function DogCompanion({ apiUrl, celebration }: { apiUrl: string; celebration?: { names: string; id: number } }) {
  const [quote, setQuote] = useState<{ text: string; author: string; expiresAt: string; stale?: boolean }>();
  const [dogPlaying, setDogPlaying] = useState(false);
  const [speechVisible, setSpeechVisible] = useState(false);
  const speechTimer = useRef<number>(undefined);
  const dogTimer = useRef<number>(undefined);
  const bark = useRef<HTMLAudioElement>(null);
  const stopAudio = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopAudio.current?.(), []);
  useEffect(() => {
    let disposed = false, loading = false, nextFetch = 0;
    let timer: number;
    const load = async () => {
      if (loading || disposed) return;
      loading = true;
      window.clearTimeout(timer);
      nextFetch = Date.now() + 5 * 60 * 1000;
      try {
        const response = await fetch(`${apiUrl}/api/quote`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Daily quote unavailable (${response.status})`);
        const result = await response.json();
        if (typeof result.text !== "string" || typeof result.author !== "string" || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("Invalid daily quote");
        if (disposed) return;
        setQuote(result);
        if (!result.stale) nextFetch = Math.max(Date.now() + 1000, Date.parse(result.expiresAt));
      } catch (error) {
        if (disposed) return;
        reportError(apiUrl, "quote", error);
        setQuote((previous) => previous ? { ...previous, stale: true } : previous);
      } finally {
        loading = false;
        if (!disposed) timer = window.setTimeout(load, Math.max(1000, nextFetch - Date.now()));
      }
    };
    const wake = () => { if (!document.hidden && Date.now() >= nextFetch) void load(); };
    void load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [apiUrl]);
  const cheer = celebration && `Hidy Ho, ${celebration.names}! Every challenge conquered. You’re a woodland legend!`;
  const playDog = () => {
    stopAudio.current?.();
    setSpeechVisible(true);
    window.clearTimeout(speechTimer.current);
    speechTimer.current = window.setTimeout(() => setSpeechVisible(false), 10000);
    setDogPlaying(true);
    if (bark.current) stopAudio.current = playBark(bark.current, cheer || undefined);
    window.clearTimeout(dogTimer.current);
    dogTimer.current = window.setTimeout(() => setDogPlaying(false), 4000);
  };
  useEffect(() => {
    if (celebration) playDog();
  }, [celebration?.id]);
  useEffect(() => () => {
    window.clearTimeout(dogTimer.current);
    window.clearTimeout(speechTimer.current);
  }, []);
  return <aside className={`dog-companion ${cheer ? "dog-celebrating" : ""}`} aria-label="Woodland companion">
    <audio ref={bark} src="/audio/bark.m4a" preload="auto" />
    {<div className="dog-announcement" role="status">{cheer ? <div className="dog-bubble" key={celebration?.id}><strong>★ Quest complete! ★</strong><p>{cheer}</p><span className="dog-stars" aria-hidden="true">✦ ★ ✧ ★ ✦</span></div> : speechVisible && quote ? <div className="dog-bubble"><blockquote>{quote.text}</blockquote></div> : null}</div>}
    <button key={celebration?.id} className="companion-dog" type="button" onClick={() => { if (!dogPlaying) playDog(); }} aria-label={cheer ? "Play bark and read congratulations" : "Play bark and show the quote of the day"}>
      <img src={(dogPlaying || (cheer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)) ? "/skins/woodland/dog-loop.gif" : "/skins/woodland/dog-first.png"} alt="A cheerful dog" width="380" height="620" />
    </button>
  </aside>;
}
