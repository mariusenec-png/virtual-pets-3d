# Virtual Pets 3D — PC prototype

A Tamagotchi-inspired 3D virtual pet simulator that runs in the browser.
Built with React, TypeScript, Vite, Three.js, React Three Fiber and Drei.
The game logic is framework-independent so it can be reused for a mobile build later.

## Requirements

- Windows 10/11 (macOS/Linux also work with the npm commands below)
- [Node.js LTS](https://nodejs.org) (20 or newer)
- A browser with WebGL (Chrome, Edge or Firefox)

## Run it

**Easiest (Windows):** double-click `start.bat`.
On the first run it installs dependencies (logged to `logs/install.log`), runs a
type check (`logs/typecheck.log`) and opens the game at http://localhost:5173.

**Manual:**

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
```

Other scripts:

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run typecheck` | TypeScript type check                          |
| `npm test`          | Unit tests for the simulation and save system  |
| `npm run build`     | Production build into `dist/`                  |
| `check.bat`         | Runs all three above and writes `logs/check.log` |
| `preview.bat`       | Production build + preview (installable PWA)   |

## Milestone status

### Milestone 1

- New pet flow: choose species, enter a name, start as a baby.
- Cozy 3D room: rotating/zooming camera, shadows, bed, food & water bowls, toys.
- The species GLB rendered in the room, with a primitive placeholder fallback if it fails to load.
- Six needs that change over time: food, water, energy, hygiene, happiness, health.
- Actions: feed (4 foods with inventory + shop), water, play (toys unlock by level),
  pet (button or click the pet), bath, sleep / wake.
- Visual feedback: the pet walks to the bowls/bed, eats, drinks, hops while playing,
  sits in a bath tub, lies down to sleep (Zzz), looks dirtier as hygiene drops,
  floating XP numbers, hearts, level-up celebration, toasts.
- XP, levels, coins, toy unlocks, passive XP for good care.
- Saving to localStorage with autosave, offline catch-up (capped and floored), corrupt-save
  protection and a visible save indicator.
- Real-time shell fur on the pet (Off / Low / High in Settings), masked around eyes, nose and
  whiskers, flattened while wet.
- Settings: game speed, developer mode (×60 / ×600 speed, skip time, edit needs, add XP),
  start over.

### Milestone 2

- **Dog** is playable (species-specific toys: tug rope, frisbee; favorite food: chicken).
- **Illnesses** (fictional): The Sniffles, Tummy Trouble, Itchy Coat, The Blues. Caused mostly by
  neglect (each has need-based triggers) plus a small random chance. Effects: health drain, faster
  need decay, no health regeneration, Tummy Trouble blocks play. Symptom bubble over the pet,
  sick pose, red status chip in the pet card, pulsing Vet button.
- **Veterinary clinic** (🏥 Vet): examine → diagnosis (symptoms + likely cause) → paid treatment
  (coins, cures + bonuses + longer immunity) or free basic treatment (cures, pet gets upset).
  Vitamin boost for healthy pets with reduced health. Short immunity after treatment.
- **Growth stages** Baby → Young → Adult require age, level and hours of good care (shown as
  "Next:" requirements in the pet card). Each stage changes size, body proportions, eye size
  (babies have bigger eyes) and fur (babies are fluffier), all eased smoothly, with a celebration.
- Dev tools: "Make sick" buttons for each illness.

### Testing milestone 2 quickly

1. Settings → enable Developer mode.
2. Illness: click a "Make sick" button, then open 🏥 Vet → Examine → choose a treatment.
3. Growth: "+50 XP" a few times and "Skip 24 h" two or three times (keep needs high with the
   sliders so good-care hours accumulate). Young needs Lv 3, 12 h age, 4 h good care;
   Adult needs Lv 7, 48 h age, 16 h good care.

### Milestone 3

- **Several pets at once** (up to 4): cat(s) and dog(s) live together in one home.
- Pet switcher above the pet card, with a status dot per pet (green ok, amber low needs,
  red sick/critical, purple sleeping). "＋" adopts another pet.
- Pets share coins and food; each pet keeps its own needs, level, illness and growth.
- All pets keep living in the background; notifications tell you when a pet in the background
  gets hungry, sick, levels up or grows.
- Welcome-back summary lists every pet. Settings → Your pets lets you rehome (remove) a pet;
  "Start over" deletes everything.
- Save format v2 (household). Version 1 saves are migrated automatically.

### Milestone 4

- **Catch the Treats** mini-game (Play → 🎮): treats fall from the ceiling, the pet runs left/right
  to catch them. Arrow keys / A-D, mouse drag or touch. 30-second rounds, golden treats (+5),
  soap bottles to avoid (−3), combo multiplier up to ×4, difficulty ramps up during the round.
  Rewards: coins (max 40), XP (max 25) and happiness; costs 12 energy (needs 20 to start).
  Best score is saved per pet.
- **Daily reward**: once per calendar day, 7-day streak (15 → 60 coins, day 7 adds a Gourmet Feast).
  Opens on start-up when available; also via the 🎁 chip.
- **New foods** in the shop: Gourmet Feast (big meal) and Vitamin Treat (+health).

### Milestone 5

- **Sound effects**, all synthesized in the browser with Web Audio (no audio files, no licensing):
  eating crunches, lapping water, bath bubbles, purring and meowing (cat), barking and happy
  panting (dog), sneezing when sick, chimes for XP / level-up / cure / growth, coins, mini-game
  catches (pitch rises with the combo), golden treats, soap bottles, countdown and fanfare.
- **Generative background music**: calm chords and arpeggios in the room, an upbeat version
  during the mini-game. Scheduled on the audio clock, paused while the tab is hidden.
- Settings → Sound: on/off, Master / Music / Effects volume (saved). 🔊/🔇 toggle in the top bar.
- Audio starts after the first click or key press (browser autoplay rules).

### Milestone 6

- **Romanian and English UI** (Settings → Language: Automatic / Română / English; automatic follows
  the browser language). All texts, game messages, item and illness names are translated
  (`src/i18n/en.ts`, `src/i18n/ro.ts`; TypeScript checks both have the same keys, tests check
  that placeholders match).
- **Installable app (PWA)**: web manifest, icons and an offline service worker in production
  builds. Run `preview.bat` (build + preview at http://localhost:4173) and use "Install" in
  Chrome/Edge or Settings → Install the app.
- **Phones**: lighter fur by default, capped pixel ratio and smaller shadow maps on mobile
  devices, no double-tap zoom on buttons, vibration on catches in the mini-game (Android).
- **Test from your phone**: the dev server now also listens on the local network. When
  `start.bat` runs it prints a `Network:` address (e.g. `http://192.168.1.20:5173`); open it on
  a phone connected to the same Wi-Fi (allow Node.js through Windows Firewall on private
  networks if asked).

Note: installing the app and offline mode need HTTPS (or `localhost`). Over the plain
`http://192.168…` address the game works on the phone, but cannot be installed there yet;
that will work once the game is hosted on an HTTPS site.

### Milestone 7

- **More lifelike, fluid animals**: the models get an automatic skeleton when they load (21 bones
  with automatic skin weights, see `docs/ASSETS.md`), animated procedurally: a trot with real leg
  steps, breathing, blinking, a head that looks around, a tail that sways (cat) or wags with the
  mood (dog), sitting down after a while, curling up to sleep (dogs stretch out with the head on
  their paws), head in the bowl while eating and drinking, a stalk-and-pounce cycle while playing,
  head tilt and half-closed eyes when petted, a full-body shake after the bath, a stretch when
  waking up, a head shake when refusing, head and tail low when ill.
- Fur follows the skeleton, and no longer looks frosted (it used to let the page background show
  through).
- **Coat markings**: the cat is a grey tabby with a pale belly and light paws; the dog has a
  darker back and a lighter belly.
- Softer, more natural lighting (procedural environment light).

### Milestone 8

- **A life of its own**: when you leave the pet alone it does things by itself: strolls around
  the rug, sits under the window and looks out, comes to the front and watches you (cats give a
  slow blink), grooms (cats lick a paw and wash the face), sniffs around (dogs), plays at the toy
  basket (cats swipe at it, dogs play-bow), chases its tail (dogs), lies down to rest, stretches,
  and sits by the bowl meowing or barking when hungry or thirsty. Purely visual: needs are not
  changed by these behaviors. The choice depends on species, personality, needs and health.
- **Personality** (random at adoption, shown in the pet card): Playful, Lazy, Curious, Foodie or
  Cuddly. Mild effects: e.g. lazy pets tire more slowly but learn more slowly, curious ones learn
  30% faster, cuddly ones love petting (+50% happiness), playful ones get more joy from toys.
  Pets from older saves get a personality automatically.
- **Tricks** (🎓 Tricks): Sit, Give paw, Lie down, Spin, Beg, Roll over, unlocking at levels 1–6.
  Each try costs 4 energy and succeeds or fails depending on how well the trick is learned and how
  happy the pet is; both teach something (success more). Successes give XP while learning;
  mastering a trick (100%) pays 25 coins, and a mastered trick always works. Training is not
  possible while asleep, sick, exhausted or very sad. Each trick has its own animation; a failed
  try shows a puzzled pet.

### Milestone 9

- **Decorate the room** (🛋️ in the top bar): a shop with 10 pieces of furniture (cardboard box,
  floor cushion, scratching post, cat tree, dog house, armchair, aquarium with swimming fish, big
  plant, floor lamp that really lights the room, bookshelf), 6 wall colors, 4 floors (oak, walnut,
  birch, tiles) and 4 rugs. Everything is bought once with coins and shared by all pets.
- Furniture stands in 6 spots along the walls: "Place"/"Move" shows glowing spots in the room,
  click one (Esc cancels). An occupied spot swaps the old piece back to storage; "Put away" frees
  a spot.
- **Pets use the furniture on their own**: cats jump up and sit on the cat tree, curl up in the box,
  nap on the armchair or cushion, stretch up the scratching post; dogs nap at the dog house and on
  the cushion; both sit in front of the aquarium following the fish. They step up onto raised
  surfaces with a little jump.
- **Comfort**: each placed piece makes pets get bored a bit slower (happiness decays up to 30%
  slower), so coins now have a long-term use. Saves from earlier versions get the default room.

### Fur update

- Fur looks much softer and more natural: strands are combed along the body and lean towards the
  tail, tips gather into small tufts, the coat is fluffier on the tail, chest and belly and short
  on the face and legs, roots are darker, the silhouette glows softly against the light and the
  coat has a silky highlight. High quality now uses 32 layers (Low stays at 12 for phones).

### Eyelids

- Cats and dogs have real eyelids now (upper and lower lid with a lash line) instead of squashing
  the eyes: they blink every few seconds, half-close when petted or feeling ill, give slow blinks
  while watching you, and close their eyes when sleeping.

### Eyelashes and eyebrows

- Eyelashes on the upper lids (they move with every blink) and eyebrows that sit on the fur and
  show emotions: raised when playing or curious, worried when sad or ill, frowning when refusing,
  one brow up when confused. Cats also have long eyebrow whiskers.

### Livelier face (this version)

- **Ears that move**: perked forward when curious or playing, flat back when annoyed or in the
  bath, drooping sideways when sad or ill, turning towards "sounds" and twitching now and then.
- **Mouth that opens**: when meowing and barking, yawning (when waking up or tired, eyes squeezed
  shut), chewing, lapping water and licking while grooming, with a tongue and little fangs. Happy
  dogs pant with the tongue out.

## Publishing (GitHub Pages)

The repository contains `.github/workflows/deploy.yml`. Every push to `main`:

1. installs dependencies (`npm ci`), runs the type check and the unit tests,
2. builds the game with the correct base path (`/<repository>/`),
3. publishes `dist/` to GitHub Pages.

One-time setup on github.com: repository **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The game is then available at `https://<user>.github.io/<repository>/`
(HTTPS, so it can be installed on phones and works offline).

Local development is unchanged (`start.bat` / `npm run dev` use base `/`).

## Project structure

```
src/
  config/        Tunable data: needs, decay rates, items, progression, growth, timing
  species/       One file per species + registry (add new animals here)
  game/          Pure game logic (no React/Three): simulation, actions, health,
                 progression, household (multiple pets)
  persistence/   Versioned save/load with validation and repair
  store/         Zustand store that connects game logic to the UI and scene
  scene/         React Three Fiber scene: room, props, pet, effects,
                 rig/ (automatic skeleton + procedural animation), fur/, coat/
  ui/            HUD, menus, dialogs
  audio/         Web Audio engine, synthesized sound effects, generative music
  i18n/          English and Romanian texts
public/models/   GLB models (see docs/ASSETS.md)
```

## Time and balance

All timing lives in `src/config/simulation.ts` and `src/config/needs.ts`.
Default speed is ×6 (1 real minute = 6 in-game minutes). While the game is closed,
the elapsed time is simulated on return, but never more than 24 in-game hours, and needs
cannot drop below a safety floor during that catch-up.
