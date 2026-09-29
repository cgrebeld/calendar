import { weekOf, type Quest } from "./quests";
import "./chore-quests.css";

export function ChoreQuests({ quests, now, onCelebrate }: { quests: Quest[]; now: Date; onCelebrate: (name: string) => void }) {
  return <div className="chore-quests">
    <p className="quest-week">Week of {weekOf(now).start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} <span>✦</span> Reach the castle!</p>
    {!quests.length && <p className="quest-empty">No challenges this week.</p>}
    {quests.map(({ name, challenges, done }, index) => {
      const complete = challenges.length > 0 && done === challenges.length;
      const hero = index % 2 ? "ninja" : "unicorn";
      return <section className={`kid-quest ${complete ? "quest-won" : ""}`} key={name} aria-label={`${name}'s weekly quest`}>
        <header><div><h3>{name}’s Quest</h3><small>{index % 2 ? "Moonlight explorer" : "Rainbow adventurer"}</small></div><b aria-label={`${done} of ${challenges.length} challenges complete`}>{done}<span>/{challenges.length}</span></b></header>
        <div className="quest-landscape">
          <span className="quest-cloud" aria-hidden="true">☁</span><span className="quest-spark" aria-hidden="true">✦</span>
          <img className="quest-castle" src="/skins/woodland/quest-castle.png" alt="" />
          <div className="quest-trail"><i style={{ width: `${challenges.length ? done / challenges.length * 100 : 0}%` }} /></div>
          <button className="quest-hero" type="button" style={{ left: `${8 + (challenges.length ? done / challenges.length : 0) * 66}%` }} disabled={!complete} onClick={() => onCelebrate(name)} aria-label={complete ? `Celebrate ${name}’s completed quest` : `${name}’s quest is still in progress`}><img src={`/skins/woodland/quest-${hero}.png`} alt="" /></button>
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
