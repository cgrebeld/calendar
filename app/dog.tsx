import { useEffect, useRef, useState } from "react";
import "./dog.css";

export function DogCompanion({ apiUrl }: { apiUrl: string }) {
  const [quote, setQuote] = useState<{ text: string; author: string; expiresAt: string; stale?: boolean }>();
  const [dogPlaying, setDogPlaying] = useState(false);
  const [speechVisible, setSpeechVisible] = useState(false);
  const speechTimer = useRef<number>(undefined);
  const dogTimer = useRef<number>(undefined);
  const bark = useRef<HTMLAudioElement>(null);
  const barkPending = useRef(false);
  useEffect(() => {
    const audio = bark.current;
    return () => {
      barkPending.current = false;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      }
    };
  }, []);
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
        if (!response.ok) throw new Error("Daily quote unavailable");
        const result = await response.json();
        if (typeof result.text !== "string" || typeof result.author !== "string" || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("Invalid daily quote");
        if (disposed) return;
        setQuote(result);
        if (!result.stale) nextFetch = Math.max(Date.now() + 1000, Date.parse(result.expiresAt));
      } catch {
        if (disposed) return;
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
  const playDog = () => {
    if (dogPlaying || barkPending.current) return;
    setSpeechVisible(true);
    window.clearTimeout(speechTimer.current);
    speechTimer.current = window.setTimeout(() => setSpeechVisible(false), 10000);
    setDogPlaying(true);
    barkPending.current = true;
    const afterBark = () => {
      barkPending.current = false;
    };
    const audio = bark.current;
    if (audio) {
      audio.currentTime = 0;
      audio.onended = afterBark;
      audio.onerror = afterBark;
      void audio.play().catch(afterBark);
    } else afterBark();
    dogTimer.current = window.setTimeout(() => setDogPlaying(false), 4000);
  };
  useEffect(() => () => {
    window.clearTimeout(dogTimer.current);
    window.clearTimeout(speechTimer.current);
  }, []);
  return <aside className="dog-companion" aria-label="Daily inspiration">
    <audio ref={bark} src="/audio/bark.m4a" preload="auto" />
    {speechVisible && quote && <div className="dog-bubble" aria-live="polite"><blockquote>{quote.text}</blockquote></div>}
    <button className="companion-dog" type="button" onClick={playDog} aria-label="Play bark and show the quote of the day">
      <img src={dogPlaying ? "/skins/woodland/dog-loop.gif" : "/skins/woodland/dog-first.png"} alt="A cheerful dog" width="380" height="620" />
    </button>
  </aside>;
}
