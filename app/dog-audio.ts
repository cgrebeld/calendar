export function playBark(audio: HTMLAudioElement, message?: string) {
  let finished = false;
  const afterBark = () => {
    if (finished) return;
    finished = true;
    if (message && "speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
    }
  };
  audio.currentTime = 0;
  audio.onended = afterBark;
  audio.onerror = afterBark;
  void audio.play().catch(afterBark);
  return () => {
    finished = true;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    if (message && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };
}
