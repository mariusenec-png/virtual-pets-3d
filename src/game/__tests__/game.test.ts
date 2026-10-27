import { describe, expect, it } from 'vitest';
import { soundForEvent } from '../../audio/soundMap';
import { getIllness } from '../../config/illnesses';
import { count, setLanguage, t } from '../../i18n';
import { en } from '../../i18n/en';
import { ro } from '../../i18n/ro';
import { arpeggioNote, chordNotes, midiToFreq, pentatonic } from '../../audio/theory';
import { getFood, REFUSE_ABOVE } from '../../config/items';
import { xpToNextLevel } from '../../config/progression';
import { SIMULATION } from '../../config/simulation';
import { loadHousehold, saveHousehold, type KeyValueStore } from '../../persistence/storage';
import { bathe, buyFood, feed, giveWater, petAnimal, play, putToSleep, wakeUp } from '../actions';
import { sanitizePetName, startNewGame } from '../createGame';
import { MS_PER_HOUR } from '../math';
import { CATCH_GAME, CATCH_REWARDS, DAILY_REWARDS } from '../../config/minigames';
import { createCatchGame, stepCatchGame, type CatchGameState } from '../catchGame';
import { claimDaily, dailyStatus } from '../daily';
import { contractIllness, giveVitamins, treatIllness } from '../health';
import { applyCatchRound, catchRewards, minigameBlockedReason } from '../minigame';
import {
  adoptPet,
  advanceHousehold,
  createHousehold,
  focus,
  getActivePet,
  MAX_PETS,
  removePet,
  setActivePet,
  simulateHousehold,
  unfocus,
} from '../household';
import { applyXp, getGrowthStage, nextStageRequirements } from '../progression';
import { advanceToNow, simulateHours } from '../simulation';
import type { GameState } from '../types';

const T0 = 1_700_000_000_000;

function newCat(): GameState {
  return startNewGame('Mochi', 'cat', T0);
}

function newHome() {
  const r = adoptPet(createHousehold(T0), 'Mochi', 'cat', T0);
  if (!r.ok) throw new Error(r.reason);
  return r.household;
}

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('pet creation', () => {
  it('creates a young named pet with starter inventory', () => {
    const g = newCat();
    expect(g.pet?.name).toBe('Mochi');
    expect(g.pet?.level).toBe(1);
    expect(getGrowthStage(g.pet!)).toBe('baby');
    expect(g.unlockedToys).toContain('ball');
    expect(g.inventory.food.kibble).toBeGreaterThan(0);
  });

  it('sanitizes names', () => {
    expect(sanitizePetName('   ')).toBeNull();
    expect(sanitizePetName('  Fluffy   Paws ')).toBe('Fluffy Paws');
    expect(sanitizePetName('A'.repeat(40))!.length).toBe(16);
  });

  it('creates a dog with dog-specific toys', () => {
    const g = startNewGame('Rex', 'dog', T0);
    expect(g.pet?.species).toBe('dog');
    expect(g.unlockedToys).toContain('ball');
    expect(play(g, 'yarn', T0).ok).toBe(false);
  });

  it('rejects empty names', () => {
    expect(() => startNewGame('   ', 'cat', T0)).toThrow();
  });
});

describe('needs over time', () => {
  it('decays needs while awake and never goes negative', () => {
    const g = newCat();
    const { state } = simulateHours(g, 200, { offline: false });
    for (const v of Object.values(state.pet!.needs)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(state.pet!.needs.satiety).toBe(0);
    expect(state.pet!.ageHours).toBeCloseTo(200, 5);
  });

  it('restores energy while sleeping and wakes up when rested', () => {
    const start = newCat();
    start.pet!.needs.energy = 20;
    const slept = putToSleep(start, T0);
    if (!slept.ok) throw new Error(slept.reason);
    const g = slept.state;
    expect(g.pet!.isSleeping).toBe(true);
    const { state, events } = simulateHours(g, 5, { offline: false });
    // Fully rested after ~3.2h, then awake (and slowly tiring) for the rest.
    expect(state.pet!.needs.energy).toBeGreaterThan(85);
    expect(state.pet!.isSleeping).toBe(false);
    expect(events.some((e) => e.type === 'wokeUp')).toBe(true);
  });

  it('collapses into sleep when exhausted', () => {
    const g = newCat();
    g.pet!.needs.energy = 6;
    const { state, events } = simulateHours(g, 1, { offline: false });
    expect(state.pet!.isSleeping).toBe(true);
    expect(events.some((e) => e.type === 'fellAsleep')).toBe(true);
  });

  it('loses health only when needs are critical, regenerates when cared for', () => {
    const g = newCat();
    g.pet!.needs.satiety = 5;
    g.pet!.needs.health = 80;
    const sick = simulateHours(g, 1, { offline: false }).state;
    expect(sick.pet!.needs.health).toBeLessThan(80);

    const good = newCat();
    Object.assign(good.pet!.needs, { satiety: 95, hydration: 95, energy: 95, hygiene: 95, happiness: 95, health: 70 });
    const healed = simulateHours(good, 1, { offline: false }).state;
    expect(healed.pet!.needs.health).toBeGreaterThan(70);
  });

  it('does not mutate the input state', () => {
    const g = newCat();
    const snapshot = JSON.stringify(g);
    simulateHours(g, 3, { offline: false });
    feed(g, 'kibble', T0);
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});

describe('offline catch-up', () => {
  it('caps the simulated duration and applies safety floors', () => {
    const g = newCat();
    g.settings.timeScale = 1;
    const now = T0 + 1000 * MS_PER_HOUR;
    const r = advanceToNow(g, now, { offline: true });
    expect(r.simulatedHours).toBe(SIMULATION.offline.maxCatchUpHours);
    expect(r.skippedHours).toBeCloseTo(1000 - SIMULATION.offline.maxCatchUpHours, 5);
    expect(r.state.lastSimulatedAt).toBe(now);
    const n = r.state.pet!.needs;
    expect(n.satiety).toBeGreaterThanOrEqual(SIMULATION.offline.needFloor);
    expect(n.health).toBeGreaterThanOrEqual(SIMULATION.offline.healthFloor);
  });

  it('handles clocks moving backwards', () => {
    const g = newCat();
    const r = advanceToNow(g, T0 - 10 * MS_PER_HOUR, { offline: true });
    expect(r.simulatedHours).toBe(0);
    expect(r.state.pet!.needs).toEqual(g.pet!.needs);
  });

  it('respects the time scale', () => {
    const g = newCat();
    g.settings.timeScale = 60;
    const r = advanceToNow(g, T0 + 60_000, { offline: false });
    expect(r.simulatedHours).toBeCloseTo(1, 5);
  });
});

describe('actions', () => {
  it('feeding raises satiety, consumes food and grants XP', () => {
    const g = newCat();
    const before = g.inventory.food.kibble;
    const r = feed(g, 'kibble', T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pet!.needs.satiety).toBeGreaterThan(g.pet!.needs.satiety);
    expect(r.state.inventory.food.kibble).toBe(before - 1);
    expect(r.state.pet!.totalXp).toBeGreaterThan(0);
  });

  it('refuses food when full and does not consume it', () => {
    const g = newCat();
    g.pet!.needs.satiety = REFUSE_ABOVE.satiety + 1;
    const r = feed(g, 'kibble', T0);
    expect(r.ok).toBe(false);
    expect(r.events.some((e) => e.type === 'activity' && e.activity === 'refuse')).toBe(true);
  });

  it('XP for the same action has a cooldown', () => {
    const g = newCat();
    g.pet!.needs.satiety = 10;
    const a = feed(g, 'kibble', T0);
    if (!a.ok) throw new Error('feed failed');
    const b = feed(a.state, 'kibble', T0 + 1000);
    if (!b.ok) throw new Error('feed failed');
    expect(b.state.pet!.totalXp).toBe(a.state.pet!.totalXp);
  });

  it('play improves happiness but costs energy', () => {
    const g = newCat();
    const r = play(g, 'ball', T0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.pet!.needs.happiness).toBeGreaterThan(g.pet!.needs.happiness);
    expect(r.state.pet!.needs.energy).toBeLessThan(g.pet!.needs.energy);
  });

  it('cannot play with locked toys or when exhausted', () => {
    const g = newCat();
    expect(play(g, 'featherWand', T0).ok).toBe(false);
    g.pet!.needs.energy = 5;
    expect(play(g, 'ball', T0).ok).toBe(false);
  });

  it('bath cleans the pet', () => {
    const g = newCat();
    g.pet!.needs.hygiene = 20;
    const r = bathe(g, T0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.pet!.needs.hygiene).toBe(100);
  });

  it('water, petting, sleep and wake work', () => {
    const g = newCat();
    const w = giveWater(g, T0);
    if (!w.ok) throw new Error(w.reason);
    expect(w.state.pet!.needs.hydration).toBeGreaterThan(g.pet!.needs.hydration);
    const p = petAnimal(w.state, T0);
    if (!p.ok) throw new Error(p.reason);
    expect(p.state.pet!.needs.happiness).toBeGreaterThan(w.state.pet!.needs.happiness);
    p.state.pet!.needs.energy = 30;
    const s = putToSleep(p.state, T0);
    if (!s.ok) throw new Error(s.reason);
    expect(feed(s.state, 'kibble', T0).ok).toBe(false);
    const up = wakeUp(s.state);
    if (!up.ok) throw new Error(up.reason);
    expect(up.state.pet!.isSleeping).toBe(false);
  });

  it('buying food costs coins', () => {
    const g = newCat();
    const r = buyFood(g, 'kibble');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.coins).toBeLessThan(g.coins);
    g.coins = 0;
    expect(buyFood(g, 'kibble').ok).toBe(false);
  });
});

describe('progression', () => {
  it('levels up, grants coins and unlocks toys', () => {
    const g = structuredClone(newCat());
    const coins = g.coins;
    const events = applyXp(g, xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3), 'test');
    expect(g.pet!.level).toBe(4);
    expect(g.coins).toBeGreaterThan(coins);
    expect(g.unlockedToys).toContain('featherWand');
    expect(events.filter((e) => e.type === 'levelUp').length).toBe(3);
  });

  it('good care grants passive XP over time', () => {
    const g = newCat();
    Object.assign(g.pet!.needs, { satiety: 100, hydration: 100, energy: 100, hygiene: 100, happiness: 100, health: 100 });
    const { state } = simulateHours(g, 2, { offline: false });
    expect(state.pet!.totalXp).toBeGreaterThan(0);
  });
});

describe('persistence', () => {
  it('round-trips a household save', () => {
    const store = memoryStore();
    const h = newHome();
    expect(saveHousehold(h, T0, store).ok).toBe(true);
    const r = loadHousehold(T0 + 1000, store);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.household.pets[0].name).toBe('Mochi');
    expect(r.household.pets[0].needs).toEqual(h.pets[0].needs);
    expect(r.household.activePetId).toBe(h.activePetId);
    expect(r.repaired).toBe(false);
  });

  it('reports corrupt saves instead of crashing', () => {
    const store = memoryStore();
    store.setItem('virtual-pets-3d/save', '{not json');
    expect(loadHousehold(T0, store).status).toBe('corrupt');
  });

  it('migrates a version 1 single-pet save', () => {
    const store = memoryStore();
    const g = newCat();
    store.setItem('virtual-pets-3d/save', JSON.stringify({ version: 1, savedAt: T0, game: g }));
    const r = loadHousehold(T0, store);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.migratedFrom).toBe(1);
    expect(r.household.pets.length).toBe(1);
    expect(r.household.activePetId).toBe(g.pet!.id);
    expect(r.household.coins).toBe(g.coins);
  });

  it('repairs out-of-range values', () => {
    const store = memoryStore();
    const g = newCat() as unknown as Record<string, unknown>;
    const pet = g.pet as Record<string, unknown>;
    (pet.needs as Record<string, unknown>).satiety = 999;
    (pet.needs as Record<string, unknown>).energy = 'oops';
    pet.level = -5;
    g.lastSimulatedAt = T0 + 365 * 24 * MS_PER_HOUR;
    store.setItem('virtual-pets-3d/save', JSON.stringify({ version: 1, savedAt: T0, game: g }));
    const r = loadHousehold(T0, store);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.repaired).toBe(true);
    const p = r.household.pets[0];
    expect(p.needs.satiety).toBe(100);
    expect(p.needs.energy).toBe(60);
    expect(p.level).toBe(1);
    expect(r.household.lastSimulatedAt).toBe(T0);
  });

  it('drops invalid pets, fixes duplicate ids and a missing active pet', () => {
    const store = memoryStore();
    const h = newHome();
    const twin = { ...h.pets[0], name: 'Twin' };
    const raw = { ...h, pets: [h.pets[0], twin, { name: 42 }], activePetId: 'nope' };
    store.setItem('virtual-pets-3d/save', JSON.stringify({ version: 2, savedAt: T0, household: raw }));
    const r = loadHousehold(T0, store);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.repaired).toBe(true);
    expect(r.household.pets.length).toBe(2);
    expect(r.household.pets[0].id === r.household.pets[1].id).toBe(false);
    expect(r.household.activePetId).toBe(r.household.pets[0].id);
  });
});

describe('household (multiple pets)', () => {
  it('adopts several pets, switching to the newest', () => {
    const h1 = newHome();
    const r = adoptPet(h1, 'Rex', 'dog', T0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.household.pets.length).toBe(2);
    expect(r.household.activePetId).toBe(r.pet.id);
    expect(getActivePet(r.household)!.species).toBe('dog');
  });

  it('rejects duplicate names, empty names and too many pets', () => {
    let h = newHome();
    expect(adoptPet(h, 'mochi', 'dog', T0).ok).toBe(false);
    expect(adoptPet(h, '  ', 'dog', T0).ok).toBe(false);
    for (let i = 0; i < MAX_PETS - 1; i++) {
      const r = adoptPet(h, `Pet ${i}`, 'dog', T0);
      if (!r.ok) throw new Error(r.reason);
      h = r.household;
    }
    expect(adoptPet(h, 'One too many', 'cat', T0).ok).toBe(false);
  });

  it('every pet keeps living in the background', () => {
    const r = adoptPet(newHome(), 'Rex', 'dog', T0);
    if (!r.ok) throw new Error(r.reason);
    const before = r.household.pets.map((p) => p.needs.satiety);
    const after = simulateHousehold(r.household, 3, { offline: false, rng: () => 0.99 }).household;
    after.pets.forEach((p, i) => {
      expect(p.needs.satiety).toBeLessThan(before[i]);
      expect(p.ageHours).toBeCloseTo(3, 5);
    });
  });

  it('actions on the focused pet share coins and food with the household', () => {
    const r = adoptPet(newHome(), 'Rex', 'dog', T0);
    if (!r.ok) throw new Error(r.reason);
    const view = focus(r.household);
    const bought = buyFood(view, 'kibble');
    if (!bought.ok) throw new Error(bought.reason);
    const h = unfocus(r.household, bought.state);
    expect(h.coins).toBeLessThan(r.household.coins);
    expect(focus(h, h.pets[0].id).coins).toBe(h.coins);
    expect(focus(h, h.pets[0].id).inventory.food.kibble).toBe(h.inventory.food.kibble);
  });

  it('switches and removes pets', () => {
    const r = adoptPet(newHome(), 'Rex', 'dog', T0);
    if (!r.ok) throw new Error(r.reason);
    const first = r.household.pets[0].id;
    const switched = setActivePet(r.household, first);
    expect(switched.activePetId).toBe(first);
    const removed = removePet(switched, first);
    expect(removed.pets.length).toBe(1);
    expect(removed.activePetId).toBe(r.pet.id);
    expect(removePet(removed, r.pet.id).activePetId).toBeNull();
  });

  it('advances all pets with the offline cap', () => {
    const r = adoptPet(newHome(), 'Rex', 'dog', T0);
    if (!r.ok) throw new Error(r.reason);
    const h = { ...r.household, settings: { ...r.household.settings, timeScale: 1 } };
    const a = advanceHousehold(h, T0 + 100 * MS_PER_HOUR, { offline: true, rng: () => 0.99 });
    expect(a.simulatedHours).toBe(SIMULATION.offline.maxCatchUpHours);
    a.household.pets.forEach((p) => expect(p.ageHours).toBeCloseTo(SIMULATION.offline.maxCatchUpHours, 5));
  });
});

describe('illness and vet', () => {
  it('neglect can make the pet sick, with the matching illness', () => {
    const g = newCat();
    g.pet!.immuneUntilAgeHours = 0;
    Object.assign(g.pet!.needs, { hygiene: 5 });
    // rng = 0 always passes the sickness roll.
    const { state, events } = simulateHours(g, 0.05, { offline: false, rng: () => 0 });
    expect(state.pet!.illness).not.toBeNull();
    expect(events.some((e) => e.type === 'gotSick')).toBe(true);
  });

  it('cannot get sick while immune or never with rng = 1', () => {
    const g = newCat();
    g.pet!.immuneUntilAgeHours = 100;
    expect(simulateHours(g, 5, { offline: false, rng: () => 0 }).state.pet!.illness).toBeNull();
    g.pet!.immuneUntilAgeHours = 0;
    expect(simulateHours(g, 5, { offline: false, rng: () => 0.999999 }).state.pet!.illness).toBeNull();
  });

  it('illness drains health and stops regeneration', () => {
    const g = newCat();
    Object.assign(g.pet!.needs, { satiety: 95, hydration: 95, energy: 95, hygiene: 95, happiness: 95, health: 80 });
    const sick = contractIllness(g, 'sniffles');
    if (!sick.ok) throw new Error(sick.reason);
    const after = simulateHours(sick.state, 2, { offline: false, rng: () => 0.99 }).state;
    expect(after.pet!.needs.health).toBeLessThan(80);
    expect(after.pet!.illness?.id).toBe('sniffles');
  });

  it('tummy trouble blocks play', () => {
    const g = newCat();
    const sick = contractIllness(g, 'tummyTrouble');
    if (!sick.ok) throw new Error(sick.reason);
    expect(play(sick.state, 'ball', T0).ok).toBe(false);
  });

  it('paid treatment cures, costs coins, grants immunity and XP', () => {
    const sick = contractIllness(newCat(), 'itchyCoat');
    if (!sick.ok) throw new Error(sick.reason);
    const r = treatIllness(sick.state, 'paid');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.pet!.illness).toBeNull();
    expect(r.state.coins).toBeLessThan(sick.state.coins);
    expect(r.state.pet!.needs.hygiene).toBe(100);
    expect(r.state.pet!.immuneUntilAgeHours).toBeGreaterThan(r.state.pet!.ageHours);
    expect(r.state.pet!.totalXp).toBeGreaterThan(sick.state.pet!.totalXp);
  });

  it('basic treatment is free so the player can never get stuck', () => {
    const sick = contractIllness(newCat(), 'sniffles');
    if (!sick.ok) throw new Error(sick.reason);
    sick.state.coins = 0;
    expect(treatIllness(sick.state, 'paid').ok).toBe(false);
    const r = treatIllness(sick.state, 'basic');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.pet!.illness).toBeNull();
    expect(r.state.coins).toBe(0);
  });

  it('vitamins only work for healthy pets with reduced health', () => {
    const g = newCat();
    expect(giveVitamins(g).ok).toBe(false);
    g.pet!.needs.health = 50;
    const r = giveVitamins(g);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.pet!.needs.health).toBe(80);
  });

  it('illness survives a save round trip', () => {
    const store = memoryStore();
    const home = newHome();
    const sick = contractIllness(focus(home), 'theBlues');
    if (!sick.ok) throw new Error(sick.reason);
    saveHousehold(unfocus(home, sick.state), T0, store);
    const r = loadHousehold(T0, store);
    if (r.status !== 'ok') throw new Error('load failed');
    expect(r.household.pets[0].illness?.id).toBe('theBlues');
  });
});

describe('growth', () => {
  it('needs age, level and good care to grow', () => {
    const pet = { ageHours: 100, level: 1, goodCareHours: 100 };
    expect(getGrowthStage(pet)).toBe('baby');
    expect(getGrowthStage({ ...pet, level: 3 })).toBe('young');
    expect(getGrowthStage({ ...pet, level: 7 })).toBe('adult');
    expect(getGrowthStage({ ageHours: 100, level: 7, goodCareHours: 1 })).toBe('baby');
  });

  it('reports the next stage requirements', () => {
    const r = nextStageRequirements({ ageHours: 13, level: 2, goodCareHours: 5 });
    expect(r?.stage.id).toBe('young');
    expect(r!.requirements.filter((x) => !x.done).map((x) => x.label)).toEqual(['level']);
    expect(nextStageRequirements({ ageHours: 999, level: 30, goodCareHours: 999 })).toBeNull();
  });

  it('a well cared-for pet grows over simulated time', () => {
    let g = newCat();
    g.pet!.immuneUntilAgeHours = 1e6;
    for (let i = 0; i < 60; i++) {
      Object.assign(g.pet!.needs, { satiety: 100, hydration: 100, energy: 100, hygiene: 100, happiness: 100, health: 100 });
      g = simulateHours(g, 1, { offline: false, rng: () => 0.99 }).state;
      applyXp(g, 20, 'test');
    }
    expect(getGrowthStage(g.pet!)).toBe('adult');
  });
});

/** Runs a catch game until it ends, with the pet always following the lowest item. */
function playCatch(perfect: boolean, rng: () => number): CatchGameState {
  const g = createCatchGame();
  for (let i = 0; i < 10_000 && !g.over; i++) {
    const target = perfect
      ? (g.items.filter((it) => it.kind !== 'hazard').sort((a, b) => a.y - b.y)[0]?.x ?? 0)
      : CATCH_GAME.maxX;
    stepCatchGame(g, 1 / 60, { targetX: target, axis: 0 }, rng);
  }
  return g;
}

function lcg(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe('catch mini-game', () => {
  it('ends after the round duration once all items have landed', () => {
    const g = playCatch(true, lcg(1));
    expect(g.over).toBe(true);
    expect(g.time).toBeGreaterThanOrEqual(CATCH_GAME.durationSeconds);
    expect(g.items.length).toBe(0);
  });

  it('a skilled player scores much more than one standing in a corner', () => {
    const good = playCatch(true, lcg(7));
    const bad = playCatch(false, lcg(7));
    expect(good.score).toBeGreaterThan(bad.score + 10);
    expect(good.caught).toBeGreaterThan(bad.caught);
  });

  it('catches an item directly above the pet and builds combos', () => {
    const g = createCatchGame();
    g.nextSpawnIn = 999;
    g.items.push({ id: 1, kind: 'treat', x: 0, y: CATCH_GAME.catchHeight + 0.01, speed: 1 });
    const ev = stepCatchGame(g, 0.05, { targetX: 0, axis: 0 }, () => 0.5);
    expect(ev.some((e) => e.type === 'catch')).toBe(true);
    expect(g.score).toBe(1);
    expect(g.combo).toBe(1);
  });

  it('hazards cost points and reset the combo; misses reset the combo', () => {
    const g = createCatchGame();
    g.nextSpawnIn = 999;
    g.score = 10;
    g.combo = 6;
    g.items.push({ id: 1, kind: 'hazard', x: 0, y: CATCH_GAME.catchHeight + 0.01, speed: 1 });
    stepCatchGame(g, 0.05, { targetX: 0, axis: 0 }, () => 0.5);
    expect(g.score).toBe(10 - CATCH_GAME.hazardPenalty);
    expect(g.combo).toBe(0);
    g.combo = 3;
    g.items.push({ id: 2, kind: 'treat', x: 1.2, y: 0.01, speed: 1 });
    stepCatchGame(g, 0.05, { targetX: -1.2, axis: 0 }, () => 0.5);
    expect(g.missed).toBe(1);
    expect(g.combo).toBe(0);
  });

  it('pet movement is limited by speed and bounds', () => {
    const g = createCatchGame();
    stepCatchGame(g, 0.1, { targetX: 5, axis: 0 }, () => 0.5);
    expect(g.petX).toBeCloseTo(CATCH_GAME.petSpeed * 0.1, 5);
    for (let i = 0; i < 100; i++) stepCatchGame(g, 0.1, { targetX: null, axis: 1 }, () => 0.5);
    expect(g.petX).toBe(CATCH_GAME.maxX);
  });
});

describe('mini-game rewards', () => {
  it('rewards are capped', () => {
    const r = catchRewards(10_000);
    expect(r.coins).toBe(CATCH_REWARDS.maxCoins);
    expect(r.xp).toBe(CATCH_REWARDS.maxXp);
    expect(catchRewards(0).coins).toBe(0);
  });

  it('a finished round gives coins, XP and costs energy', () => {
    const g = newCat();
    const r = applyCatchRound(g, { score: 30, caught: 25, bestCombo: 12 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.coins).toBe(g.coins + catchRewards(30).coins);
    expect(r.state.pet!.needs.energy).toBeLessThan(g.pet!.needs.energy);
    expect(r.state.pet!.totalXp).toBeGreaterThan(0);
    expect(r.state.pet!.stats.bestCatch).toBe(30);
  });

  it('cannot play when sleeping, too tired or too sick', () => {
    const g = newCat();
    expect(minigameBlockedReason(g)).toBeNull();
    g.pet!.needs.energy = 5;
    expect(minigameBlockedReason(g)).not.toBeNull();
    g.pet!.needs.energy = 80;
    g.pet!.isSleeping = true;
    expect(minigameBlockedReason(g)).not.toBeNull();
    g.pet!.isSleeping = false;
    const sick = contractIllness(g, 'tummyTrouble');
    if (!sick.ok) throw new Error(sick.reason);
    expect(minigameBlockedReason(sick.state)).not.toBeNull();
  });
});

describe('daily reward', () => {
  const day = 24 * MS_PER_HOUR;
  const noon = new Date(2026, 9, 27, 12, 0, 0).getTime();

  it('can be claimed once per day and grows with a streak', () => {
    let h = newHome();
    expect(dailyStatus(h, noon).available).toBe(true);
    const c1 = claimDaily(h, noon);
    if (!c1) throw new Error('claim failed');
    expect(c1.household.coins).toBe(h.coins + DAILY_REWARDS.coins[0]);
    h = c1.household;
    expect(claimDaily(h, noon + MS_PER_HOUR)).toBeNull();
    const c2 = claimDaily(h, noon + day);
    if (!c2) throw new Error('claim failed');
    expect(c2.status.day).toBe(2);
  });

  it('a missed day resets the streak; day 7 gives a bonus treat, then it restarts', () => {
    let h = newHome();
    for (let i = 0; i < 7; i++) {
      const c = claimDaily(h, noon + i * day);
      if (!c) throw new Error('claim failed');
      h = c.household;
    }
    expect(h.daily.streak).toBe(7);
    expect(h.inventory.food.gourmetFeast).toBe(1);
    expect(dailyStatus(h, noon + 7 * day).day).toBe(1);
    expect(dailyStatus(h, noon + 9 * day).day).toBe(1);
  });
});

describe('audio helpers', () => {
  it('converts MIDI notes to frequencies', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });

  it('builds chords and arpeggios from chord tones', () => {
    expect(chordNotes({ root: 60, quality: 'major' })).toEqual([60, 64, 67]);
    const chord = { root: 57, quality: 'min7' as const };
    const tones = new Set(chordNotes(chord).map((n) => n + 12));
    for (let i = 0; i < 16; i++) expect(tones.has(arpeggioNote(chord, i))).toBe(true);
    expect(pentatonic(60, 72)).toEqual([60, 62, 64, 67, 69, 72]);
  });

  it('maps game events to species-appropriate sounds', () => {
    expect(soundForEvent({ type: 'activity', activity: 'petted' }, 'cat')).toBe('purr');
    expect(soundForEvent({ type: 'activity', activity: 'play' }, 'dog')).toBe('bark');
    expect(soundForEvent({ type: 'xp', amount: 3, source: 'care' }, 'cat')).toBeNull();
    expect(soundForEvent({ type: 'gotSick', illnessId: 'sniffles' }, 'dog')).toBe('sneeze');
  });

  it('old saves get default audio settings', () => {
    const store = memoryStore();
    const h = newHome() as unknown as { settings: Record<string, unknown> };
    delete h.settings.audio;
    store.setItem('virtual-pets-3d/save', JSON.stringify({ version: 2, savedAt: T0, household: h }));
    const r = loadHousehold(T0, store);
    if (r.status !== 'ok') throw new Error('load failed');
    expect(r.household.settings.audio.muted).toBe(false);
    expect(r.household.settings.audio.master).toBeGreaterThan(0);
  });
});

describe('i18n', () => {
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

  it('Romanian has every key with the same placeholders as English', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof ro[key]).toBe('string');
      expect(ro[key].length).toBeGreaterThan(0);
      expect(params(ro[key])).toBe(params(en[key]));
    }
  });

  it('formats text with parameters and Romanian plurals', () => {
    setLanguage('ro');
    expect(t('msg.notHungry', { name: 'Mochi' })).toBe('Lui Mochi nu îi e foame acum.');
    expect(count(1, 'unit.hour')).toBe('1 oră');
    expect(count(6, 'unit.hour')).toBe('6 ore');
    expect(count(24, 'unit.hour')).toBe('24 de ore');
    expect(count(101, 'unit.hour')).toBe('101 ore');
    setLanguage('en');
    expect(count(1, 'unit.hour')).toBe('1 hour');
    expect(count(24, 'unit.hour')).toBe('24 hours');
    expect(t('need.satiety')).toBe('Food');
  });

  it('config labels follow the current language', () => {
    setLanguage('ro');
    expect(getFood('kibble')!.name).toBe('Granule uscate');
    expect(getIllness('sniffles')!.symptoms.length).toBe(3);
    setLanguage('en');
    expect(getFood('kibble')!.name).toBe('Dry Kibble');
  });
});
