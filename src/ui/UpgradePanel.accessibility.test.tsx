import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UpgradePanel } from './UpgradePanel';
import {
  storeApi,
  PRESTIGE_THRESHOLD,
  type Resources,
  type Modules,
} from '@/state/store';
import { formatInteger } from '@/lib/formatters';

describe('ui/UpgradePanel - accessibility', () => {
  let originalResources: Resources;
  let originalModules: Modules;

  beforeEach(() => {
    const state = storeApi.getState();
    originalResources = { ...state.resources };
    originalModules = { ...state.modules };

    // Set a known state for testing
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...s.resources, bars: 100 }, // Ensure some bars
        modules: {
          ...s.modules,
          refinery: 1, // Level 1 refinery
        },
      }));
    });
  });

  afterEach(() => {
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...originalResources },
        modules: { ...originalModules },
      }));
    });
  });

  it('provides descriptive aria-labels for buy buttons', () => {
    render(<UpgradePanel />);

    // Check for a specific buy button, e.g., for "Refinery"
    // The label is likely "Refinery" in moduleDefinitions
    const buyButtons = screen.getAllByText(/Buy \(/);
    expect(buyButtons.length).toBeGreaterThan(0);

    // We expect the button to have an accessible name that includes more detail
    // This will fail initially as we haven't implemented it yet
    const refineryButton = screen.getByRole('button', {
      name: /Buy Refinery level 2 for/i,
    });
    expect(refineryButton).toBeInTheDocument();
  });

  it('provides a title explaining why buy button is disabled', () => {
    // Set bars to 0 to ensure unaffordable
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...s.resources, bars: 0 },
      }));
    });

    render(<UpgradePanel />);
    const buyButtons = screen.getAllByRole('button', { name: /Buy/i });

    // Check the first disabled button (all should be disabled)
    const disabledButton = buyButtons[0];
    expect(disabledButton).toBeDisabled();
    expect(disabledButton).toHaveAttribute('title', 'Not enough warehouse bars');
  });

  it('provides a title explaining why prestige button is disabled', () => {
    // Set bars below threshold
    act(() => {
      storeApi.setState((s) => ({
        ...s,
        resources: { ...s.resources, bars: 0 },
      }));
    });

    render(<UpgradePanel />);
    const prestigeButton = screen.getByRole('button', { name: /Prestige Run/i });
    expect(prestigeButton).toBeDisabled();
    expect(prestigeButton).toHaveAttribute(
      'title',
      `Requires ${formatInteger(PRESTIGE_THRESHOLD)} bars to prestige`
    );
  });
});
