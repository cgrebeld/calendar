import { useEffect, useRef, useState } from "react";
import { chorePets, weekOf, type Quest } from "./quests";
import "./chore-quests.css";

export const pets = chorePets(import.meta.env.VITE_CHORE_PETS ?? "Ada:dragon,Clio:otter");

function QuestCharacter({ name, species, complete, progress, onCelebrate }: { name: string; species: string; complete: boolean; progress: number; onCelebrate: (name: string) => void }) {
  const [replay, setReplay] = useState(0);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) setReplay(value => value + 1);
    if (!complete) setReplay(0);
    wasComplete.current = complete;
  }, [complete]);
  return <button className="quest-hero" type="button" style={{ left: `${8 + progress * 66}%` }} disabled={!complete} onClick={() => {
    setReplay(value => value + 1);
    onCelebrate(name);
  }} aria-label={complete ? `Celebrate ${name}’s completed quest` : `${name}’s quest is still in progress`}>
    <span key={replay} className={`quest-character ${replay ? "character-celebrate" : ""}`} style={{ backgroundImage: `url(/characters/${species}.png)` }} aria-hidden="true" onAnimationEnd={() => setReplay(0)} />
  </button>;
}

export function ChoreQuests({ quests, now, onCelebrate }: { quests: Quest[]; now: Date; onCelebrate: (name: string) => void }) {
  return <div className="chore-quests">
    <p className="quest-week">Week of {weekOf(now).start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} <span>✦</span> Find the treasure!</p>
    {!quests.length && <p className="quest-empty">No challenges this week.</p>}
    {quests.map(({ name, challenges, done }) => {
      const complete = challenges.length > 0 && done === challenges.length;
      const hero = pets.get(name.toLowerCase()) ?? "dragon";
      return <section className={`kid-quest ${complete ? "quest-won" : ""}`} key={name} aria-label={`${name}'s weekly quest`}>
        <header><div><h3>{name}’s Quest</h3><small>{hero === "otter" ? "Pebble the otter" : "Moss the dragon"}</small></div><b aria-label={`${done} of ${challenges.length} challenges complete`}>{done}<span>/{challenges.length}</span></b></header>
        <div className="quest-landscape">
          <span className="quest-cloud" aria-hidden="true">☁</span><span className="quest-spark" aria-hidden="true">✦</span>
          <span className="quest-chest" aria-hidden="true" />
          <div className="quest-trail"><i style={{ width: `${challenges.length ? done / challenges.length * 100 : 0}%` }} /></div>
          <QuestCharacter name={name} species={hero} complete={complete} progress={challenges.length ? done / challenges.length : 0} onCelebrate={onCelebrate} />
          <span className="quest-start">START</span><span className="quest-goal">{complete ? "★ FOUND!" : "TREASURE"}</span>
        </div>
        <p className="quest-caption">{complete ? "★ Quest complete. You’re a star!" : challenges.length ? `${challenges.length - done} more to the treasure` : "A new adventure awaits…"}</p>
        <ol className="quest-challenges">{challenges.map((task, step) => <li key={task.id} className={task.completed ? "challenge-done" : ""}>
          <span className="challenge-stone" aria-label={task.completed ? "Completed" : "Not completed"}>{task.completed ? "★" : step + 1}</span><span>{task.title}</span>
        </li>)}</ol>
        {!challenges.length && <p className="quest-empty">No challenges for this week.</p>}
      </section>;
    })}
  </div>;
}
