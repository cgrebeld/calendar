import { weekOf, type Quest } from "./quests";
import "./chore-quests.css";

export function ChoreQuests({ quests, now }: { quests: Quest[]; now: Date }) {
  return <div className="chore-quests">
    <p className="quest-week">Week of {weekOf(now).start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} <span>✦</span> Reach the castle!</p>
    {!quests.length && <p className="quest-empty">No challenges this week.</p>}
    {quests.map(({ name, challenges, done }, index) => {
      const complete = challenges.length > 0 && done === challenges.length;
      const hero = index % 2 ? "ninja" : "unicorn";
      return <section className={`kid-quest ${complete ? "quest-won" : ""}`} key={name} aria-label={`${name}'s weekly quest`}>
        <header><div><h3>{name}’s Quest</h3><small>{index % 2 ? "Moonlight explorer" : "Rainbow adventurer"}</small></div><b aria-label={`${done} of ${challenges.length} challenges complete`}>{done}<span>/{challenges.length}</span></b></header>
        <div className="quest-landscape" aria-hidden="true">
          <span className="quest-cloud">☁</span><span className="quest-spark">✦</span>
          <img className="quest-castle" src="/skins/woodland/quest-castle.svg" alt="" />
          <div className="quest-trail"><i style={{ width: `${challenges.length ? done / challenges.length * 100 : 0}%` }} /></div>
          <img className="quest-hero" style={{ left: `${8 + (challenges.length ? done / challenges.length : 0) * 66}%` }} src={`/skins/woodland/quest-${hero}.svg`} alt="" />
          <span className="quest-start">START</span><span className="quest-goal">{complete ? "★ HOME!" : "CASTLE"}</span>
        </div>
        <p className="quest-caption">{complete ? "★ Quest complete. You’re a star!" : challenges.length ? `${challenges.length - done} more to the castle` : "A new adventure awaits…"}</p>
        <ol className="quest-challenges">{challenges.map((task, step) => <li key={task.id} className={task.completed ? "challenge-done" : ""}>
          <span className="challenge-stone" aria-label={task.completed ? "Completed" : "Not completed"}>{task.completed ? "★" : step + 1}</span><span>{task.title}</span>
        </li>)}</ol>
        {!challenges.length && <p className="quest-empty">No challenges for this week.</p>}
      </section>;
    })}
  </div>;
}
