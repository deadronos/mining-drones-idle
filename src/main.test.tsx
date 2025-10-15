import { cleanup, waitFor, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, afterEach, test, expect } from 'vitest';

beforeEach(() => {
  // Ensure a #root element exists before importing main (which mounts into #root)
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
});

afterEach(() => {
  cleanup();
  const root = document.getElementById('root');
  root?.parentNode?.removeChild(root);
});

test('main mounts App into #root', async () => {
  // Import the module after the #root exists so it can mount. Wrap in act to
  // avoid React's warning about state updates not wrapped in act().
  await act(async () => {
    await import('./main');
  });

  // App's heading should be present
  await waitFor(() => expect(screen.getByText('Vite + React')).toBeTruthy());
});
