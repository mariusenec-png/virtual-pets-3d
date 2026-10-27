import { create } from 'zustand';
import { playSound } from '../audio/engine';
import { soundForEvent } from '../audio/soundMap';
import { count, list, resolveLanguage, setLanguage, t, type LanguageSetting, type MessageKey } from '../i18n';
import { ACTIVITY_DURATION_MS, BLOCKING_ACTIVITIES, TRICK_DURATION_MS } from '../config/activities';
import { getPersonality, randomPersonality } from '../config/personality';
import { getTrick } from '../config/tricks';
import { practiceTrick } from '../game/tricks';
import { getDecor, type DecorKind } from '../config/decor';
import { buyDecor, placeDecor, removeDecor, setTheme } from '../game/decor';
import { getIllness } from '../config/illnesses';
import { getToy } from '../config/items';
import { NEEDS } from '../config/needs';
import { SIMULATION } from '../config/simulation';
import * as actions from '../game/actions';
import { claimDaily, dailyStatus, type DailyStatus } from '../game/daily';
import { contractIllness, giveVitamins, treatIllness, type TreatmentKind } from '../game/health';
import { applyCatchRound, catchRewards, minigameBlockedReason, type CatchRewards, type CatchRoundResult } from '../game/minigame';
import { resetCatchRuntime } from '../scene/minigame/runtime';
import {
  adoptPet,
  advanceHousehold,
  createHousehold,
  focus,
  removePet,
  setActivePet,
  simulateHousehold,
  unfocus,
} from '../game/household';
import { clampNeed } from '../game/math';
import { applyXp, getGrowthStage, getGrowthStageDefinition } from '../game/progression';
import { cloneState } from '../game/simulation';
import type {
  ActionResult,
  ActivityKind,
  AudioSettings,
  FurQuality,
  GameEvent,
  GameState,
  GrowthStage,
  Household,
  NeedId,
  PetEvent,
  PetState,
  SpeciesId,
} from '../game/types';
import { backupCorruptSave, clearSave, loadHousehold, saveHousehold } from '../persistence/storage';
import { getSpecies } from '../species/registry';

/**
 * The single game store. It owns the persisted Household (all pets) plus
 * transient presentation state (current activity, toasts, visual effects,
 * save status). `game` is a single-pet view of the active pet, recomputed on
 * every change, so the UI and the game rules only ever deal with one pet.
 * Game rules live in src/game; this file only orchestrates them.
 */

export type Phase = 'loading' | 'newPet' | 'playing';

export interface Activity {
  kind: ActivityKind;
  itemId?: string;
  startedAt: number;
  durationMs: number;
  /** Increments for every new activity so the scene can detect restarts. */
  seq: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export type FxKind = 'xp' | 'levelUp' | 'hearts' | 'grow';

export interface FxEvent {
  id: number;
  kind: FxKind;
  label?: string;
  at: number;
}

export interface SaveStatus {
  state: 'idle' | 'saving' | 'saved' | 'error';
  at?: number;
  error?: string;
}

export interface MinigameState {
  phase: 'intro' | 'countdown' | 'playing' | 'result';
  /** Real timestamp when the current phase started. */
  phaseStartedAt: number;
  result?: CatchRoundResult & { rewards: CatchRewards; newBest: boolean; previousBest: number };
}

export interface WelcomeBackPet {
  id: string;
  name: string;
  lowNeeds: NeedId[];
  illnessId: string | null;
}

export interface WelcomeBack {
  simulatedHours: number;
  skippedHours: number;
  pets: WelcomeBackPet[];
}

interface Store {
  phase: Phase;
  /** Source of truth: every pet plus shared coins/food/settings. */
  household: Household;
  /** Single-pet view of the active pet (derived from household). */
  game: GameState;
  activity: Activity | null;
  toasts: Toast[];
  fx: FxEvent[];
  save: SaveStatus;
  welcomeBack: WelcomeBack | null;
  /** True when the GLB failed and a placeholder is shown. */
  usingPlaceholder: boolean;
  /** Set when the pet just reached a new growth stage (shows a celebration). */
  grewTo: GrowthStage | null;
  /** Active mini-game session (null when not playing). */
  minigame: MinigameState | null;
  /** Daily reward dialog is open. */
  dailyOpen: boolean;
  /** Furniture being placed (the scene shows the free spots). */
  decorPlacing: string | null;

  boot(): void;
  /** Adopts a pet and makes it active. Returns an error message on failure. */
  createPet(name: string, species: SpeciesId): string | null;
  switchPet(petId: string): void;
  /** Gives a pet away (removes it). */
  rehomePet(petId: string): void;
  tick(): void;
  saveNow(): void;

  feed(foodId: string): void;
  water(): void;
  play(toyId: string): void;
  pet(): void;
  bathe(): void;
  sleep(): void;
  wake(): void;
  buyFood(foodId: string): void;
  treat(kind: TreatmentKind): boolean;
  vitamins(): boolean;
  /** Practices (or shows off) a trick with the active pet. */
  practiceTrick(trickId: string): boolean;
  buyDecor(id: string): boolean;
  startPlacing(id: string): void;
  cancelPlacing(): void;
  placeDecor(slotId: string): void;
  removeDecor(slotId: string): void;
  setTheme(kind: Exclude<DecorKind, 'furniture'>, id: string): void;

  setTimeScale(value: number): void;
  setDevMode(on: boolean): void;
  setFurQuality(q: FurQuality): void;
  setAudio(patch: Partial<AudioSettings>): void;
  setLanguagePreference(lang: LanguageSetting): void;
  devSkipHours(hours: number): void;
  devSetNeed(id: NeedId, value: number): void;
  devAddXp(amount: number): void;
  devMakeSick(illnessId: string): void;
  /** Deletes every pet and the save. */
  resetAll(): void;

  openMinigame(): void;
  startMinigame(): void;
  beginPlaying(): void;
  finishMinigame(result: CatchRoundResult): void;
  closeMinigame(): void;
  getDailyStatus(): DailyStatus;
  openDaily(): void;
  claimDailyReward(): void;
  closeDaily(): void;
  popFx(kind: FxKind, label: string): void;

  dismissToast(id: number): void;
  dismissWelcome(): void;
  dismissGrowth(): void;
  setUsingPlaceholder(v: boolean): void;
}

let nextId = 1;
let activitySeq = 0;
let ticksSinceSave = 0;

function now(): number {
  return Date.now();
}

export function isBusy(activity: Activity | null, at: number = now()): boolean {
  return !!activity && BLOCKING_ACTIVITIES.has(activity.kind) && at < activity.startedAt + activity.durationMs;
}

// Pick an initial language from the browser until the save is loaded.
setLanguage(resolveLanguage('auto'));

export const useGameStore = create<Store>()((set, get) => {
  function pushToast(text: string, tone: Toast['tone'] = 'info') {
    const toast: Toast = { id: nextId++, text, tone };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    window.setTimeout(() => get().dismissToast(toast.id), tone === 'bad' ? 4200 : 3200);
  }

  function pushFx(kind: FxKind, label?: string) {
    const fx: FxEvent = { id: nextId++, kind, label, at: now() };
    set((s) => ({ fx: [...s.fx.slice(-12), fx] }));
    window.setTimeout(() => set((s) => ({ fx: s.fx.filter((f) => f.id !== fx.id) })), 2600);
  }

  function startActivity(kind: ActivityKind, itemId?: string) {
    activitySeq += 1;
    const durationMs = (kind === 'trick' && itemId && TRICK_DURATION_MS[itemId]) || ACTIVITY_DURATION_MS[kind];
    set({ activity: { kind, itemId, startedAt: now(), durationMs, seq: activitySeq } });
  }

  function persist(household: Household) {
    set({ save: { state: 'saving' } });
    const r = saveHousehold(household, now());
    ticksSinceSave = 0;
    set({ save: r.ok ? { state: 'saved', at: now() } : { state: 'error', error: r.error } });
  }

  /** Stores a new household and refreshes the active-pet view. */
  function commit(household: Household) {
    set({ household, game: focus(household) });
  }

  /** Splits pet events into the active pet's and toasts for the pets in the background. */
  function dispatchPetEvents(events: PetEvent[], prev: Household, opts: { warnings: boolean }) {
    const activeId = get().household.activePetId;
    const active = events.filter((e) => e.petId === activeId).map((e) => e.event);
    if (activeId) handleEvents(active, focus(prev, activeId));
    const current = get().household;
    for (const pet of current.pets) {
      if (pet.id === activeId) continue;
      const mine = events.filter((e) => e.petId === pet.id).map((e) => e.event);
      handleBackgroundEvents(pet, mine, prev.pets.find((p) => p.id === pet.id) ?? null, opts);
    }
  }

  /** Short notifications for a pet that is not on screen. */
  function handleBackgroundEvents(pet: PetState, events: GameEvent[], prev: PetState | null, opts: { warnings: boolean }) {
    for (const e of events) {
      if (e.type === 'levelUp') {
        playSound('coin');
        pushToast(t('toast.bgLevelUp', { name: pet.name, level: e.level, coins: e.coins }), 'good');
      }
      else if (e.type === 'gotSick') {
        const ill = getIllness(e.illnessId);
        pushToast(t('toast.bgSick', { name: pet.name, illness: ill?.name ?? '?', icon: ill?.icon ?? '' }), 'bad');
      } else if (e.type === 'warning' && opts.warnings) pushToast(warningText(pet.name, e.need), 'bad');
    }
    if (prev && getGrowthStage(prev) !== getGrowthStage(pet)) {
      pushToast(t('toast.bgGrew', { name: pet.name, stage: getGrowthStageDefinition(pet).label }), 'good');
    }
  }

  function handleEvents(events: GameEvent[], prev: GameState | null) {
    const game = get().game;
    const pet = game.pet;
    for (const e of events) {
      if (pet) playSound(soundForEvent(e, pet.species));
      switch (e.type) {
        case 'activity':
          startActivity(e.activity, e.itemId);
          if (e.activity === 'petted') pushFx('hearts');
          break;
        case 'xp':
          if (e.source !== 'care') pushFx('xp', `+${e.amount} XP`);
          break;
        case 'levelUp': {
          const unlocked = e.unlocked.map((id) => getToy(id)?.name).filter(Boolean);
          pushFx('levelUp', t('fx.level', { level: e.level }));
          pushToast(
            t('toast.levelUp', { name: pet?.name ?? t('common.yourPet'), level: e.level, coins: e.coins }) +
              (unlocked.length ? t('toast.unlocked', { list: list(unlocked as string[]) }) : ''),
            'good',
          );
          // Celebrate once the current activity ends.
          const a = get().activity;
          const delay = a ? Math.max(0, a.startedAt + a.durationMs - now()) : 0;
          window.setTimeout(() => {
            if (!get().game.pet?.isSleeping) startActivity('celebrate');
          }, delay);
          break;
        }
        case 'fellAsleep':
          pushToast(t('toast.fellAsleep', { name: pet?.name ?? '' }), 'bad');
          startActivity('sleep');
          break;
        case 'wokeUp':
          pushToast(t('toast.wokeUp', { name: pet?.name ?? '' }), 'good');
          startActivity('wake');
          break;
        case 'warning':
          if (pet) pushToast(warningText(pet.name, e.need), 'bad');
          break;
        case 'message':
          pushToast(e.text, e.tone);
          break;
        case 'gotSick': {
          const ill = getIllness(e.illnessId);
          pushToast(t('toast.gotSick', { name: pet?.name ?? '', illness: ill?.name ?? '?', icon: ill?.icon ?? '' }), 'bad');
          break;
        }
        case 'cured': {
          const ill = getIllness(e.illnessId);
          pushToast(t('toast.cured', { name: pet?.name ?? '', illness: ill?.name ?? '?', treatment: e.treatment }), 'good');
          break;
        }
        case 'trickMastered': {
          const trick = getTrick(e.trickId);
          pushFx('levelUp', `${trick?.icon ?? '🏆'} ${trick?.name ?? ''}`);
          pushToast(t('toast.trickMastered', { name: pet?.name ?? '', trick: trick?.name ?? '', coins: e.coins }), 'good');
          break;
        }
        case 'coins':
          break;
      }
    }
    // Growth stage changes are derived, so compare before/after.
    if (prev?.pet && pet && getGrowthStage(prev.pet) !== getGrowthStage(pet)) {
      const def = getGrowthStageDefinition(pet);
      pushFx('grow', `${def.label}!`);
      playSound('grow');
      set({ grewTo: def.id });
    }
  }

  function runAction(fn: (g: GameState, t: number) => ActionResult, opts: { allowWhileBusy?: boolean } = {}): boolean {
    const { game, activity, household } = get();
    if (!game.pet) return false;
    if (!opts.allowWhileBusy && isBusy(activity)) return false;
    const prev = game;
    const r = fn(game, now());
    if (r.ok) {
      const next = unfocus(household, r.state);
      commit(next);
      handleEvents(r.events, prev);
      persist(next);
    } else {
      handleEvents(r.events, null);
    }
    return r.ok;
  }

  function resetPresentation() {
    resetCatchRuntime(false);
    set({ activity: null, fx: [], usingPlaceholder: false, grewTo: null, minigame: null });
  }

  return {
    phase: 'loading',
    household: createHousehold(now()),
    game: focus(createHousehold(now())),
    activity: null,
    toasts: [],
    fx: [],
    save: { state: 'idle' },
    welcomeBack: null,
    usingPlaceholder: false,
    grewTo: null,
    minigame: null,
    dailyOpen: false,
    decorPlacing: null,

    boot() {
      // Guard against double invocation (React StrictMode runs effects twice in dev).
      if (get().phase !== 'loading') return;
      const t0 = now();
      const r = loadHousehold(t0);
      if (r.status === 'ok') setLanguage(resolveLanguage(r.household.settings.language));
      if (r.status === 'ok' && r.household.pets.length > 0) {
        const caught = advanceHousehold(r.household, t0, { offline: true });
        commit(caught.household);
        set({ phase: 'playing' });
        // Only show the summary when meaningful time passed (> 10 in-game minutes).
        if (caught.simulatedHours > 1 / 6) {
          set({
            welcomeBack: {
              simulatedHours: caught.simulatedHours,
              skippedHours: caught.skippedHours,
              pets: caught.household.pets.map((pet) => ({
                id: pet.id,
                name: pet.name,
                lowNeeds: (Object.keys(NEEDS) as NeedId[]).filter((id) => pet.needs[id] < NEEDS[id].warnBelow),
                illnessId: pet.illness?.id ?? null,
              })),
            },
          });
        }
        // While away, only level-ups and illnesses are worth a notification.
        dispatchPetEvents(
          caught.events.filter((e) => e.event.type === 'levelUp' || e.event.type === 'gotSick'),
          r.household,
          { warnings: false },
        );
        if (r.repaired) pushToast(t('toast.repaired'), 'info');
        if (dailyStatus(caught.household, t0).available) set({ dailyOpen: true });
        persist(caught.household);
        return;
      }
      if (r.status === 'ok') {
        // Save exists but has no pets: keep settings, coins and food.
        commit(r.household);
        set({ phase: 'newPet' });
        return;
      }
      if (r.status === 'corrupt') {
        backupCorruptSave();
        pushToast(t('toast.corrupt', { error: r.error }), 'bad');
      }
      set({ phase: 'newPet' });
    },

    createPet(name, species) {
      const at = now();
      // Bring everyone up to date before adding a new pet.
      const caught = advanceHousehold(get().household, at, { offline: false });
      const r = adoptPet(caught.household, name, species, at, randomPersonality());
      if (!r.ok) return r.reason;
      commit(r.household);
      resetPresentation();
      set({ phase: 'playing', welcomeBack: null });
      persist(r.household);
      playSound('adopt');
      pushToast(t('toast.welcome', { name: r.pet.name, icon: getSpecies(species).icon }), 'good');
      const personality = getPersonality(r.pet.personality);
      pushToast(
        t('toast.personality', {
          name: r.pet.name,
          personality: `${personality.icon} ${personality.name.toLocaleLowerCase()}`,
          desc: personality.description,
        }),
        'info',
      );
      return null;
    },

    switchPet(petId) {
      const h = get().household;
      if (h.activePetId === petId) return;
      const next = setActivePet(h, petId);
      commit(next);
      resetPresentation();
      persist(next);
    },

    rehomePet(petId) {
      const h = get().household;
      const pet = h.pets.find((p) => p.id === petId);
      if (!pet) return;
      const next = removePet(h, petId);
      commit(next);
      resetPresentation();
      if (next.pets.length === 0) set({ phase: 'newPet' });
      persist(next);
      pushToast(t('toast.rehomed', { name: pet.name }), 'info');
    },

    tick() {
      const { household, phase } = get();
      if (phase !== 'playing' || household.pets.length === 0) return;
      const r = advanceHousehold(household, now(), { offline: false });
      commit(r.household);
      // Always dispatch: growth can happen from age alone, without any event.
      dispatchPetEvents(r.events, household, { warnings: true });
      ticksSinceSave += 1;
      if (ticksSinceSave * SIMULATION.tickIntervalMs >= SIMULATION.autosaveIntervalMs) persist(r.household);
    },

    saveNow() {
      const { household } = get();
      if (household.pets.length > 0) persist(household);
    },

    feed: (foodId) => void runAction((g, t) => actions.feed(g, foodId, t)),
    water: () => void runAction((g, t) => actions.giveWater(g, t)),
    play: (toyId) => void runAction((g, t) => actions.play(g, toyId, t)),
    pet: () => void runAction((g, t) => actions.petAnimal(g, t)),
    bathe: () => void runAction((g, t) => actions.bathe(g, t)),
    sleep: () => void runAction((g, t) => actions.putToSleep(g, t)),
    wake: () => void runAction((g) => actions.wakeUp(g)),
    buyFood: (foodId) => void runAction((g) => actions.buyFood(g, foodId), { allowWhileBusy: true }),
    treat: (kind) => runAction((g) => treatIllness(g, kind), { allowWhileBusy: true }),
    vitamins: () => runAction((g) => giveVitamins(g), { allowWhileBusy: true }),
    practiceTrick: (trickId) => runAction((g, at) => practiceTrick(g, trickId, at)),

    buyDecor(id) {
      const r = buyDecor(get().household, id);
      if (!r.ok) {
        pushToast(r.reason, 'bad');
        playSound('refuse');
        return false;
      }
      commit(r.household);
      persist(r.household);
      playSound('coin');
      pushToast(t('toast.decorBought', { item: getDecor(id)?.name ?? id }), 'good');
      return true;
    },
    startPlacing: (id) => set({ decorPlacing: id }),
    cancelPlacing: () => set({ decorPlacing: null }),
    placeDecor(slotId) {
      const id = get().decorPlacing;
      set({ decorPlacing: null });
      if (!id) return;
      const r = placeDecor(get().household, id, slotId);
      if (!r.ok) {
        pushToast(r.reason, 'bad');
        return;
      }
      commit(r.household);
      persist(r.household);
      playSound('click');
      pushToast(t('toast.decorPlaced', { item: getDecor(id)?.name ?? id }), 'info');
    },
    removeDecor(slotId) {
      const next = removeDecor(get().household, slotId);
      commit(next);
      persist(next);
      playSound('click');
    },
    setTheme(kind, id) {
      const r = setTheme(get().household, kind, id);
      if (!r.ok) {
        pushToast(r.reason, 'bad');
        return;
      }
      commit(r.household);
      persist(r.household);
      playSound('click');
    },

    setTimeScale(value) {
      // Bring the simulation up to date with the old scale before switching.
      const caught = advanceHousehold(get().household, now(), { offline: false });
      const next = { ...caught.household, settings: { ...caught.household.settings, timeScale: value } };
      commit(next);
      persist(next);
    },

    setDevMode(on) {
      const h = get().household;
      let timeScale = h.settings.timeScale;
      if (!on && timeScale > 6) timeScale = 6;
      const next = { ...h, settings: { ...h.settings, devMode: on, timeScale } };
      commit(next);
      persist(next);
    },

    setFurQuality(furQuality) {
      const h = get().household;
      const next = { ...h, settings: { ...h.settings, furQuality } };
      commit(next);
      persist(next);
    },

    setLanguagePreference(language) {
      setLanguage(resolveLanguage(language));
      const h = get().household;
      const next = { ...h, settings: { ...h.settings, language } };
      commit(next);
      persist(next);
    },

    setAudio(patch) {
      const h = get().household;
      const next = { ...h, settings: { ...h.settings, audio: { ...h.settings.audio, ...patch } } };
      commit(next);
      persist(next);
    },

    devSkipHours(hours) {
      const prev = get().household;
      if (prev.pets.length === 0) return;
      const r = simulateHousehold(prev, hours, { offline: false });
      const next = { ...r.household, lastSimulatedAt: now() };
      commit(next);
      dispatchPetEvents(
        r.events.filter((e) => e.event.type !== 'warning'),
        prev,
        { warnings: false },
      );
      pushToast(t('toast.skipped', { time: count(hours, 'unit.hour') }), 'info');
      persist(next);
    },

    devSetNeed(id, value) {
      const { game, household } = get();
      if (!game.pet) return;
      const view = cloneState(game);
      view.pet!.needs[id] = clampNeed(value);
      const next = unfocus(household, view);
      commit(next);
      persist(next);
    },

    devAddXp(amount) {
      const { game, household } = get();
      if (!game.pet) return;
      const view = cloneState(game);
      const events = applyXp(view, amount, 'dev');
      const next = unfocus(household, view);
      commit(next);
      handleEvents(events, game);
      persist(next);
    },

    devMakeSick(illnessId) {
      runAction((g) => contractIllness(g, illnessId), { allowWhileBusy: true });
    },

    resetAll() {
      const settings = get().household.settings;
      clearSave();
      commit(createHousehold(now(), settings));
      resetPresentation();
      set({ phase: 'newPet', welcomeBack: null, save: { state: 'idle' } });
    },

    openMinigame() {
      const reason = minigameBlockedReason(get().game);
      if (reason) {
        pushToast(reason, 'bad');
        return;
      }
      if (isBusy(get().activity)) return;
      resetCatchRuntime(false);
      set({ minigame: { phase: 'intro', phaseStartedAt: now() }, activity: null });
    },

    startMinigame() {
      const reason = minigameBlockedReason(get().game);
      if (reason) {
        pushToast(reason, 'bad');
        set({ minigame: null });
        return;
      }
      resetCatchRuntime(true);
      set({ minigame: { phase: 'countdown', phaseStartedAt: now() } });
    },

    beginPlaying() {
      const mg = get().minigame;
      if (mg?.phase !== 'countdown') return;
      playSound('go');
      set({ minigame: { phase: 'playing', phaseStartedAt: now() } });
    },

    finishMinigame(result) {
      const mg = get().minigame;
      if (mg?.phase !== 'playing') return;
      const previousBest = get().game.pet?.stats.bestCatch ?? 0;
      const ok = runAction((g) => applyCatchRound(g, result), { allowWhileBusy: true });
      if (!ok) {
        set({ minigame: null });
        return;
      }
      playSound('gameOver');
      set({
        minigame: {
          phase: 'result',
          phaseStartedAt: now(),
          result: {
            ...result,
            rewards: catchRewards(result.score),
            newBest: result.score > previousBest,
            previousBest,
          },
        },
      });
    },

    closeMinigame() {
      resetCatchRuntime(false);
      set({ minigame: null });
    },

    getDailyStatus() {
      return dailyStatus(get().household, now());
    },

    openDaily() {
      set({ dailyOpen: true });
    },

    claimDailyReward() {
      const r = claimDaily(get().household, now());
      if (!r) return;
      commit(r.household);
      persist(r.household);
      playSound('daily');
      pushToast(t('toast.daily', { coins: r.status.coins, extra: r.status.food ? t('toast.dailyExtra') : '' }), 'good');
    },

    closeDaily() {
      set({ dailyOpen: false });
    },

    popFx(kind, label) {
      pushFx(kind, label);
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    dismissWelcome() {
      set({ welcomeBack: null });
    },
    dismissGrowth() {
      set({ grewTo: null });
    },
    setUsingPlaceholder(v) {
      if (get().usingPlaceholder !== v) set({ usingPlaceholder: v });
    },
  };
});

function warningText(name: string, need: NeedId): string {
  return t(`warn.${need}` as MessageKey, { name });
}
