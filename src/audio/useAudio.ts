import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { audio, playSound } from './engine';
import { music, type MusicMode } from './music';

/**
 * Connects the audio engine to the game: volume settings, unlocking audio on
 * the first user gesture (browser autoplay rules), music mode (room vs
 * mini-game), pausing while the tab is hidden, and a soft click on buttons.
 */
export function useAudio(): void {
  const settings = useGameStore((s) => s.household.settings.audio);
  const inMinigame = useGameStore((s) => !!s.minigame);

  useEffect(() => {
    audio.setSettings(settings);
  }, [settings]);

  // Pick the music for the current screen; stop it entirely when inaudible.
  useEffect(() => {
    const desired: MusicMode | null = settings.muted || settings.music <= 0 ? null : inMinigame ? 'game' : 'home';
    const apply = () => {
      if (!audio.isRunning) return;
      if (desired) music.start(desired);
      else music.stop();
    };
    apply();
    // Music can only start after the first gesture unlocks audio.
    const onGesture = () => {
      audio.unlock();
      window.setTimeout(apply, 50);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [inMinigame, settings.muted, settings.music]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') audio.suspend();
      else audio.resume();
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('button')) playSound('click');
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, true);
      music.stop();
    };
  }, []);
}
