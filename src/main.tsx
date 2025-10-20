import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { createPersistenceManager } from '@/state/persistence';

const persistence = createPersistenceManager();

declare global {
  interface Window {
    __persistence?: ReturnType<typeof createPersistenceManager>;
    __appReady?: boolean;
  }
}

if (typeof window !== 'undefined') {
  persistence.load();
  persistence.start();
  // Expose for e2e tests to call import/export helpers directly when needed
  // (kept only in browser runtime). Tests will check for this property.
  window.__persistence = persistence;
  // App readiness flag for e2e tests — start as false and flip to true after first paint.
  window.__appReady = false;
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

// After the first paint, signal readiness to e2e tests. Use RAF to ensure the DOM is present.
if (typeof window !== 'undefined') {
  // Ensure deterministic readiness for tests by setting the flag synchronously after render.
  // Also schedule a RAF as a fallback to cover paint timing.
  try {
    window.__appReady = true;
  } catch {
    // noop
  }
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-app-ready', 'true');
    }
  } catch {
    // noop
  }
  requestAnimationFrame(() => {
    try {
      window.__appReady = true;
    } catch {
      // noop
    }
  });
}
