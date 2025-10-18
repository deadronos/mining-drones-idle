import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UpgradePanel } from './UpgradePanel';
import {
  storeApi,
  PRESTIGE_THRESHOLD,
  type Resources,
  type Modules,
  type Prestige,
} from '@/state/store';

describe('ui/UpgradePanel - prestige button', () => {
  let originalResources: Resources;
  let originalModules: Modules;
  let originalPrestige: Prestige;

  beforeEach(() => {
    const state = storeApi.getState();
    originalResources = { ...state.resources };
    originalModules = { ...state.modules };
    originalPrestige = { ...state.prestige };

    // set baseline: bars just below threshold
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...s.resources, bars: PRESTIGE_THRESHOLD - 1 },
        prestige: { cores: 0 },
      }));
    });
  });

  afterEach(() => {
    // restore only the pieces we changed
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...originalResources },
        modules: { ...originalModules },
        prestige: { ...originalPrestige },
      }));
    });
  });

  it('enables the Prestige Run button when bars cross the threshold', async () => {
    render(<UpgradePanel />);

    const button = screen.getByRole('button', { name: /Prestige Run/i });
    expect(button).toBeDisabled();

    // bump bars above threshold
    await act(async () => {
      storeApi.setState((s) => ({
        resources: { ...s.resources, bars: PRESTIGE_THRESHOLD + 100 },
      }));
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Prestige Run/i })).not.toBeDisabled(),
    );
  });
});
