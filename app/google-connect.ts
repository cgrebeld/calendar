let stopWaiting: (() => void) | undefined;

export function connectGoogle(apiUrl: string, photos = false) {
  stopWaiting?.();
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, "0")).join("");
  const channel = new BroadcastChannel(`google-connect-${id}`);
  const query = new URLSearchParams({ returnTo: location.origin, popup: id, photos: String(photos) });
  const popup = window.open(`${apiUrl}/api/auth/start?${query}`, "calendar-google", "popup=yes,width=560,height=640");
  if (!popup) {
    channel.close();
    throw new Error("The sign-in window was blocked. Allow popups for this calendar, then try again.");
  }
  // Google can sever the opener and make popup.closed true before sign-in finishes.
  const timer = window.setTimeout(() => stop(), 10 * 60 * 1000);
  const stop = () => { channel.close(); window.clearTimeout(timer); };
  stopWaiting = stop;
  channel.onmessage = event => {
    if (event.data !== "connected") return;
    stop();
    if (photos) location.assign("/?photos=settings");
    else location.reload();
  };
}

export function googlePopupId(search: string) {
  const query = new URLSearchParams(search);
  const id = query.get("popup") ?? "";
  return query.get("google") === "connected" && /^[a-f0-9]{32}$/.test(id) ? id : undefined;
}

export function finishGooglePopup(id: string) {
  const channel = new BroadcastChannel(`google-connect-${id}`);
  channel.postMessage("connected");
  channel.close();
  window.close();
}
