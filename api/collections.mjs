const services = { garbage: { area: "Victoria", id: 217, summary: "Garbage and organics" }, recycling: { area: "CRD", id: 247, summary: "Recycling" } };

export function collectionAddress(results, address) {
  const street = address.replace(/,?\s*Victoria(?:,?\s*BC)?\s*$/i, "").trim().toLowerCase();
  const matches = results.filter((item) => item.name?.toLowerCase() === `${street}, victoria` && /^[0-9a-f-]{36}$/i.test(item.place_id));
  if (matches.length !== 1) throw new Error(`Collection address was ${matches.length ? "ambiguous" : "not found"}`);
  return matches[0].place_id;
}

export function collectionDates(ics, summary) {
  const events = [];
  for (const block of ics.replace(/\r\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1)) {
    const date = /^DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})\r?$/m.exec(block);
    const title = /^SUMMARY:(.*?)\r?$/m.exec(block);
    if (!date || title?.[1]?.toLowerCase() !== summary.toLowerCase()) continue;
    const [, year, month, day] = date;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(month) && parsed.getUTCDate() === Number(day)) events.push(`${year}-${month}-${day}`);
  }
  return [...new Set(events)];
}

export async function loadCollection(kind, address, fetcher = fetch) {
  const { area, id, summary } = services[kind];
  const query = encodeURIComponent(address.replace(/,?\s*BC\s*$/i, "").trim());
  const base = "https://api.recollect.net/api";
  const lookup = await fetcher(`${base}/areas/${area}/services/${id}/address-suggest?q=${query}`, { signal: AbortSignal.timeout(10000) });
  if (!lookup.ok) throw new Error(`${area} address lookup returned ${lookup.status}`);
  const placeId = collectionAddress(await lookup.json(), address);
  const response = await fetcher(`${base}/places/${placeId}/services/${id}/events.en.ics`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${area} calendar returned ${response.status}`);
  const ics = await response.text();
  if (ics.length > 1000000 || !ics.startsWith("BEGIN:VCALENDAR") || !ics.includes("END:VCALENDAR")) throw new Error(`${area} calendar is invalid`);
  const dates = collectionDates(ics, summary);
  if (!dates.length) throw new Error(`${area} has no ${summary.toLowerCase()} dates`);
  return dates.map((date) => ({ date, kind }));
}
