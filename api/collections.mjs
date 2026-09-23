const services = { garbage: { area: "Victoria", id: 217, summary: "Garbage and organics" }, recycling: { area: "CRD", id: 247, summary: "Recycling" } };

export function collectionAddress(results, address) {
  const street = address.replace(/,?\s*Victoria(?:,?\s*BC)?\s*$/i, "").trim().toLowerCase();
  const matches = results.filter((item) => item.name?.toLowerCase() === `${street}, victoria` && /^[0-9a-f-]{36}$/i.test(item.place_id));
  if (matches.length !== 1) throw new Error(`Collection address was ${matches.length ? "ambiguous" : "not found"}`);
  return matches[0].place_id;
}

export function collectionDates(data, kind) {
  if (!Array.isArray(data.events)) throw new Error("Collection events response is invalid");
  return [...new Set(data.events.filter((event) => event.flags?.some((flag) => flag.event_type === "pickup" && (kind === "garbage" ? ["garbage", "kitchenscraps"].includes(flag.name) : flag.name === "recycling"))).map((event) => event.day).filter((day) => {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const parsed = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day);
  }))];
}

export async function loadCollection(kind, address, fetcher = fetch) {
  const { area, id, summary } = services[kind];
  const query = encodeURIComponent(address.replace(/,?\s*BC\s*$/i, "").trim());
  const base = "https://api.recollect.net/api";
  const lookup = await fetcher(`${base}/areas/${area}/services/${id}/address-suggest?q=${query}`, { signal: AbortSignal.timeout(10000) });
  if (!lookup.ok) throw new Error(`${area} address lookup returned ${lookup.status}`);
  const placeId = collectionAddress(await lookup.json(), address);
  const today = new Date();
  const after = new Date(today.getTime() - 31 * 86400000).toISOString().slice(0, 10);
  const before = new Date(today.getTime() + 366 * 86400000).toISOString().slice(0, 10);
  const response = await fetcher(`${base}/places/${placeId}/services/${id}/events?after=${after}&before=${before}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${area} calendar returned ${response.status}`);
  const dates = collectionDates(await response.json(), kind);
  if (!dates.length) throw new Error(`${area} has no ${summary.toLowerCase()} dates`);
  return dates.map((date) => ({ date, kind }));
}
