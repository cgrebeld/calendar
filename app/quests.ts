export type Task = { id: string; title: string; completed?: boolean; due?: string; completedAt?: string };
export type NoteList = { id: string; label: string; items: Task[] };
export function kidNames(value: string) {
  return [...new Set(value.split(",").map(name => name.trim()).filter(Boolean))];
}
export function weekOf(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { start, end, key: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}` };
}
export function weeklyQuests(items: Task[], kids: string[], now: Date) {
  const { start, end } = weekOf(now);
  const inWeek = (date: Date) => date >= start && date < end;
  return kids.map(name => {
    const challenges = items.flatMap(task => {
      const match = task.title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (!match || match[1].trim().toLowerCase() !== name.toLowerCase()) return [];
      // Google due dates are calendar dates, not UTC instants.
      const due = task.due && new Date(`${task.due.slice(0, 10)}T00:00:00`);
      if (due ? !inWeek(due) : task.completed && (!task.completedAt || !inWeek(new Date(task.completedAt)))) return [];
      return [{ ...task, title: match[2] }];
    });
    return { name, challenges, done: challenges.filter(task => task.completed).length };
  });
}
export type Quest = ReturnType<typeof weeklyQuests>[number];
export function newlyCompleted(previous: Quest[], current: Quest[]) {
  return current.filter(quest => quest.challenges.length > 0 && quest.done === quest.challenges.length && previous.some(old =>
    old.name === quest.name && old.challenges.some(task => !task.completed && quest.challenges.some(next => next.id === task.id && next.completed))
  )).map(quest => quest.name);
}
