import { createCatchGame, type CatchGameState, type CatchInput } from '../../game/catchGame';

/**
 * Live state of the running mini-game. It changes every frame, so it lives
 * in a plain mutable object instead of the React store (no re-renders).
 */
export const catchRuntime: {
  game: CatchGameState | null;
  input: CatchInput;
  lastCatchAt: number;
  lastHazardAt: number;
  /** Half of the world width currently visible at the play line (set by the camera). */
  viewHalfWidth: number;
} = {
  game: null,
  input: { targetX: null, axis: 0 },
  lastCatchAt: 0,
  lastHazardAt: 0,
  viewHalfWidth: 1.6,
};

export function resetCatchRuntime(active: boolean): void {
  catchRuntime.game = active ? createCatchGame() : null;
  catchRuntime.input = { targetX: null, axis: 0 };
  catchRuntime.lastCatchAt = 0;
  catchRuntime.lastHazardAt = 0;
}

/** Depth (z) of the mini-game play line, in front of the rug. */
export const CATCH_Z = 0.45;
/** Half of the horizontal world width the camera keeps in view during the game. */
export const CATCH_VIEW_HALF_WIDTH = 1.6;
