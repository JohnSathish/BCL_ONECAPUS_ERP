import type { LibraryVoiceCue } from '@/types/library';

export function unlockLibrarySpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}

export function speakLibraryLine(voice: LibraryVoiceCue) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !voice.text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(voice.text);
  utter.rate = voice.rate;
  utter.volume = voice.volume;
  const voices = synth.getVoices();
  const chosen =
    voices.find((row) => row.name === voice.voiceName) ||
    voices.find((row) => row.lang.toLowerCase().startsWith('en'));
  if (chosen) utter.voice = chosen;
  synth.speak(utter);
  return true;
}

export function libraryVoiceList() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((row) => row.lang.toLowerCase().startsWith('en'));
}
