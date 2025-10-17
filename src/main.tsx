import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { createPersistenceManager } from '@/state/persistence';

const persistence = createPersistenceManager();

if (typeof window !== 'undefined') {
  persistence.load();
  persistence.start();
  // Expose for e2e tests to call import/export helpers directly when needed
  // (kept only in browser runtime). Tests will check for this property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__persistence = persistence;
  window.addEventListener('beforeunload', () => {
    persistence.saveNow();
    persistence.stop();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistence.saveNow();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App persistence={persistence} />
  </StrictMode>,
);
