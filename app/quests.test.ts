import test from "node:test";
import assert from "node:assert/strict";
import { weeklyQuests, weekOf, newlyCompleted } from "./quests.ts";

test("weekly quests assign kids, use date-only due dates, and exclude tasks due outside the week", () => {
  const now = new Date(2026, 8, 29, 12);
  const items = [
    { id: "a", title: "Ada - Make bed", due: "2026-09-28T00:00:00.000Z" },
    { id: "b", title: "ada – Tidy room", completed: true, completedAt: new Date(2026, 8, 29).toISOString() },
    { id: "c", title: "Clio — Feed dog" },
    { id: "d", title: "Ada - Old", completed: true, completedAt: "2026-09-20T12:00:00Z" },
    { id: "e", title: "Ada - Next", due: "2026-10-05T00:00:00Z" },
    { id: "f", title: "Unassigned" },
    { id: "g", title: "Ada - Sunday", due: "2026-10-04T00:00:00Z" },
  ];
  const quests = weeklyQuests(items, now);
  assert.deepEqual(quests.map(q => [q.name, q.done, q.challenges.length]), [["Ada", 2, 4], ["Clio", 0, 1]]);
  assert.equal(weekOf(new Date(2026, 10, 1, 12)).start.getDate(), 26);
  const complete = weeklyQuests(items.map(t => ({ ...t, completed: true, completedAt: now.toISOString() })), now);
  assert.deepEqual(newlyCompleted(quests, complete), ["Ada", "Clio"]);
  assert.deepEqual(newlyCompleted([], complete), []);
  assert.deepEqual(newlyCompleted(complete, complete), []);
  assert.deepEqual(newlyCompleted(quests, weeklyQuests(items.filter(t => t.id === "b"), now)), []);
});


test("quest names come from colon and dash prefixes, with optional spaces and case-insensitive grouping", () => {
  const quests = weeklyQuests([
    { id: "a", title: " Ada:Make bed " },
    { id: "b", title: "ada-Tidy room" },
    { id: "c", title: "Clio - Feed dog" },
    { id: "d", title: "Robin: Put away toys" },
    { id: "e", title: "No prefix" },
    { id: "f", title: " : Missing name" },
    { id: "g", title: "Ada:   " },
    { id: "h", title: "Past: Old task", due: "2020-01-01T00:00:00Z" },
  ], new Date(2026, 8, 29));
  assert.deepEqual(quests.map(q => [q.name, q.challenges.map(t => t.title)]), [
    ["Ada", ["Make bed", "Tidy room"]], ["Clio", ["Feed dog"]], ["Robin", ["Put away toys"]],
  ]);
  assert.deepEqual(weeklyQuests([], new Date()), []);
});


test("undated completed chores count toward progress even before this week or without a completion timestamp", () => {
  const [quest] = weeklyQuests([
    { id: "done1", title: "Clio - Empty Dishwasher", completed: true, completedAt: "2026-09-27T16:07:14.588Z" },
    { id: "done2", title: "Clio - Empty Dishwasher", completed: true, completedAt: "2026-09-23T02:17:02.978Z" },
    { id: "open1", title: "Clio - Set Table", completed: false },
    { id: "open2", title: "Clio - Set Table", completed: false },
  ], new Date(2026, 8, 29));
  assert.equal(quest.done, 2);
  assert.equal(quest.challenges.length, 4);
  assert.equal(weeklyQuests([{ id: "done", title: "Ada: Tidy", completed: true }], new Date())[0].done, 1);
});
