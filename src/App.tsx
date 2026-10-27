import { Fragment, useEffect, useState } from 'react';
import { useAudio } from './audio/useAudio';
import { PetScene } from './scene/PetScene';
import { useGameStore } from './store/gameStore';
import { ActionBar } from './ui/ActionBar';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useGameLoop } from './ui/hooks';
import { PetCard, TopBar } from './ui/Hud';
import { PetSwitcher } from './ui/PetSwitcher';
import { NeedsPanel } from './ui/NeedsPanel';
import { NewPetScreen } from './ui/NewPetScreen';
import { SettingsPanel } from './ui/SettingsPanel';
import { Toasts } from './ui/Toasts';
import { DailyReward } from './ui/DailyReward';
import { GrowthDialog } from './ui/GrowthDialog';
import { MinigameOverlay } from './ui/MinigameOverlay';
import { VetPanel } from './ui/VetPanel';
import { DecorPanel, PlacingBanner } from './ui/DecorPanel';
import { WelcomeBack } from './ui/WelcomeBack';
import { t } from './i18n';

export default function App() {
  useGameLoop();
  useAudio();
  const phase = useGameStore((s) => s.phase);
  const speciesId = useGameStore((s) => s.game.pet?.species);
  const petId = useGameStore((s) => s.game.pet?.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vetOpen, setVetOpen] = useState(false);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [decorOpen, setDecorOpen] = useState(false);
  const placing = useGameStore((s) => !!s.decorPlacing);
  const cancelPlacing = useGameStore((s) => s.cancelPlacing);
  useEffect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPlacing();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, cancelPlacing]);
  const inMinigame = useGameStore((s) => !!s.minigame);
  // Remount the UI (not the 3D scene) when the language changes so every text updates.
  const language = useGameStore((s) => s.household.settings.language);

  if (phase === 'loading') {
    return <div className="splash">{t('app.loading')}</div>;
  }

  return (
    <div className="app">
      {phase === 'playing' && speciesId && petId ? (
        <>
          <ErrorBoundary
            fallback={
              <div className="scene-error">
                <h2>{t('scene.webglTitle')}</h2>
                <p>{t('scene.webglText')}</p>
              </div>
            }
          >
            <PetScene petId={petId} speciesId={speciesId} />
          </ErrorBoundary>
          <Fragment key={language}>
          <div className={`hud ${inMinigame ? 'hud-hidden' : ''}`}>
            <header className="topbar">
              <div className="topbar-left">
                <PetSwitcher onAdopt={() => setAdoptOpen(true)} />
                <PetCard onOpenVet={() => setVetOpen(true)} />
              </div>
              <TopBar onOpenSettings={() => setSettingsOpen(true)} onOpenDecor={() => setDecorOpen(true)} />
            </header>
            <aside className="side">
              <NeedsPanel />
            </aside>
            <footer className="bottom">
              <ActionBar onOpenVet={() => setVetOpen(true)} />
            </footer>
          </div>
          <MinigameOverlay />
          <WelcomeBack />
          <DailyReward />
          <GrowthDialog />
          {vetOpen && <VetPanel onClose={() => setVetOpen(false)} />}
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          {decorOpen && !placing && <DecorPanel onClose={() => setDecorOpen(false)} />}
          <PlacingBanner />
          {adoptOpen && <NewPetScreen onDone={() => setAdoptOpen(false)} />}
          </Fragment>
        </>
      ) : (
        <NewPetScreen key={language} />
      )}
      <Toasts />
    </div>
  );
}
