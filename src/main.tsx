import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initCloud } from './store/cloud';
import './index.css';

// Service Worker für PWA (Offline-Grundgerüst, automatische Updates).
registerSW({ immediate: true });

// Cloud-Synchronisierung starten (nur wenn konfiguriert – sonst bleibt alles lokal).
void initCloud();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
