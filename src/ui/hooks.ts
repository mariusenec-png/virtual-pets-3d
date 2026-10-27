import { useEffect, useState } from 'react';
import { SIMULATION } from '../config/simulation';
import { isBusy, useGameStore } from '../store/gameStore';

/** Drives the simulation and autosave while the game is open. */
export function useGameLoop(): void {
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    useGameStore.getState().boot();
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => useGameStore.getState().tick(), SIMULATION.tickIntervalMs);
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') useGameStore.getState().saveNow();
    };
    const saveOnLeave = () => useGameStore.getState().saveNow();
    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', saveOnLeave);
    window.addEventListener('beforeunload', saveOnLeave);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', saveOnLeave);
      window.removeEventListener('beforeunload', saveOnLeave);
    };
  }, [phase]);
}

/** True while a blocking activity plays; re-renders when it ends. */
export function useIsBusy(): boolean {
  const activity = useGameStore((s) => s.activity);
  const [, bump] = useState(0);
  const busy = isBusy(activity);
  useEffect(() => {
    if (!activity || !busy) return;
    const remaining = activity.startedAt + activity.durationMs - Date.now();
    const id = window.setTimeout(() => bump((n) => n + 1), Math.max(0, remaining) + 20);
    return () => window.clearTimeout(id);
  }, [activity, busy]);
  return busy;
}

/** Re-renders every `ms` milliseconds (for relative time labels). */
export function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
