import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preloadSpeciesModel } from './scene/pet/PetModel';
import { SPECIES_LIST } from './species/registry';
import './styles.css';

// Start downloading available species models early.
for (const s of SPECIES_LIST) if (s.available) preloadSpeciesModel(s.model.url);

// Offline support for the installed app. Only in production builds: a service
// worker during development would serve stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.warn('[virtual-pets-3d] Service worker failed:', e));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
