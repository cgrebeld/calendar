export function shufflePhotos<T extends { id: string }>(photos: readonly T[], previousId?: string, random = Math.random): T[] {
  const shuffled = [...photos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.length > 1 && shuffled[0].id === previousId) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

export function adjacentPhoto<T extends { id: string }>(items: readonly T[], currentId: string | undefined, direction: -1 | 1): string | undefined {
  if (!items.length) return undefined;
  const index = Math.max(0, items.findIndex(({ id }) => id === currentId));
  return items[(index + direction + items.length) % items.length].id;
}

export function photoLabel({ date, city }: { date?: string; city?: string }): string {
  const parsed = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : undefined;
  return [city, parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : undefined].filter(Boolean).join(" · ");
}
