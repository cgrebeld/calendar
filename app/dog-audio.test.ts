import test from "node:test";
import assert from "node:assert/strict";
import { playBark } from "./dog-audio.ts";

test("speech follows the bark once, tolerates playback failure, and stops on cleanup", async () => {
  const spoken: string[] = [];
  let cancelled = 0;
  Object.assign(globalThis, {
    window: { speechSynthesis: { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => cancelled++ } },
    SpeechSynthesisUtterance: class { text: string; constructor(text: string) { this.text = text; } },
  });
  try {
    let rejectPlay: (reason: Error) => void;
    const audio = {
      currentTime: 7,
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
      play: () => new Promise<void>((_, reject) => { rejectPlay = reject; }),
      pause: () => {},
    };
    const play = (message?: string) => playBark(audio as unknown as HTMLAudioElement, message);
    let stop = play("Well done, Ada!");
    assert.equal(audio.currentTime, 0);
    assert.deepEqual(spoken, []);
    audio.onended!();
    audio.onerror!();
    assert.deepEqual(spoken, ["Well done, Ada!"]);
    stop();
    assert.equal(audio.onended, null);
    assert.equal(cancelled, 1);

    stop = play("Well done, Clio!");
    audio.onerror!();
    rejectPlay!(new Error("Playback failed"));
    await Promise.resolve();
    assert.deepEqual(spoken, ["Well done, Ada!", "Well done, Clio!"]);
    stop();

    stop = play("Cancelled");
    stop();
    rejectPlay!(new Error("Playback interrupted"));
    await Promise.resolve();
    assert.equal(spoken.length, 2);

    stop = play();
    audio.onended!();
    assert.equal(spoken.length, 2);
    stop();

    Object.assign(globalThis, { window: {} });
    stop = play("No speech support");
    audio.onended!();
    stop();
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  }
});
