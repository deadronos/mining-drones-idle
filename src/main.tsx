import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { createPersistenceManager } from '@/state/persistence';

const persistence = createPersistenceManager();

if (typeof window !== 'undefined') {
  persistence.load();
  persistence.start();
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
