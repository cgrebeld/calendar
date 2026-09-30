export type Task = { id: string; title: string; completed?: boolean; due?: string; completedAt?: string };
export type NoteList = { id: string; label: string; items: Task[] };
export function weekOf(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { start, end, key: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}` };
}
export function weeklyQuests(items: Task[], now: Date) {
  const { start, end } = weekOf(now);
  const inWeek = (date: Date) => date >= start && date < end;
  const quests = new Map<string, { name: string; challenges: Task[]; done: number }>();
  for (const task of items) {
    const match = task.title.match(/^(.+?)\s*[:–—-]\s*(.+)$/);
    const name = match?.[1].trim(), title = match?.[2].trim();
    if (!name || !title) continue;
    // Google due dates are calendar dates, not UTC instants.
    const due = task.due && new Date(`${task.due.slice(0, 10)}T00:00:00`);
    if (due && !inWeek(due)) continue;
    const key = name.toLowerCase();
    if (!quests.has(key)) quests.set(key, { name, challenges: [], done: 0 });
    const quest = quests.get(key)!;
    quest.challenges.push({ ...task, title });
    if (task.completed) quest.done++;
  }
  return [...quests.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export type Quest = ReturnType<typeof weeklyQuests>[number];
export function newlyCompleted(previous: Quest[], current: Quest[]) {
  return current.filter(quest => quest.challenges.length > 0 && quest.done === quest.challenges.length && previous.some(old =>
    old.name.toLowerCase() === quest.name.toLowerCase() && old.challenges.some(task => !task.completed && quest.challenges.some(next => next.id === task.id && next.completed))
  )).map(quest => quest.name);
}

export function chorePets(value: string) {
  const pets = new Map<string, "dragon" | "otter">();
  for (const entry of value.split(",")) {
    const [name, species, extra] = entry.trim().toLowerCase().split(":").map(part => part.trim());
    if (name && extra === undefined && (species === "dragon" || species === "otter")) pets.set(name, species);
  }
  return pets;
}
