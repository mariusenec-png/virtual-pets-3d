import type { GameEvent, SpeciesId } from '../game/types';

/** All sound effects the game can play. */
export type SoundId =
  | 'click'
  | 'coin'
  | 'xp'
  | 'levelUp'
  | 'eat'
  | 'drink'
  | 'bath'
  | 'purr'
  | 'meow'
  | 'bark'
  | 'happyDog'
  | 'sleep'
  | 'wake'
  | 'refuse'
  | 'sneeze'
  | 'cured'
  | 'warning'
  | 'catch'
  | 'golden'
  | 'hazard'
  | 'miss'
  | 'countdown'
  | 'go'
  | 'gameOver'
  | 'daily'
  | 'grow'
  | 'adopt';

/** Which sound (if any) a game event makes. Pure, so it can be tested. */
export function soundForEvent(event: GameEvent, species: SpeciesId): SoundId | null {
  switch (event.type) {
    case 'activity':
      switch (event.activity) {
        case 'eat':
          return 'eat';
        case 'drink':
          return 'drink';
        case 'bath':
          return 'bath';
        case 'play':
          return species === 'cat' ? 'meow' : 'bark';
        case 'petted':
          return species === 'cat' ? 'purr' : 'happyDog';
        case 'sleep':
          return 'sleep';
        case 'wake':
          return 'wake';
        case 'refuse':
          return 'refuse';
        case 'trick':
          return species === 'cat' ? 'meow' : 'happyDog';
        default:
          return null;
      }
    case 'xp':
      return event.source === 'care' ? null : 'xp';
    case 'levelUp':
      return 'levelUp';
    case 'coins':
      return event.amount !== 0 ? 'coin' : null;
    case 'gotSick':
      return 'sneeze';
    case 'cured':
      return 'cured';
    case 'trickMastered':
      return 'levelUp';
    case 'warning':
      return 'warning';
    case 'fellAsleep':
      return 'sleep';
    case 'wokeUp':
      return 'wake';
    default:
      return null;
  }
}
