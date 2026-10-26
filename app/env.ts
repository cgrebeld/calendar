// Build-time VITE_ values, overridden by the container's runtime-env.js (written from its environment at start).
const runtime: Record<string, string | undefined> = (globalThis as { __CALENDAR_ENV__?: Record<string, string> }).__CALENDAR_ENV__ ?? {};

export const env: Record<string, string | undefined> = { ...import.meta.env, ...runtime };
