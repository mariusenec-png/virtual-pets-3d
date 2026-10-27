import { useEffect, useState } from 'react';
import { t } from '../i18n';

/** Chrome/Edge fire this event when the app can be installed (PWA). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** "Install the app" section; only shown when the browser offers installation. */
export function InstallSection() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!deferred) return null;
  return (
    <section>
      <h3>{t('settings.install')}</h3>
      <p className="muted small">{t('settings.installHelp')}</p>
      <button
        className="btn btn-small btn-primary"
        onClick={async () => {
          const ev = deferred;
          if (!ev) return;
          await ev.prompt();
          await ev.userChoice;
          deferred = null;
          bump((n) => n + 1);
        }}
      >
        {t('settings.installButton')}
      </button>
    </section>
  );
}
