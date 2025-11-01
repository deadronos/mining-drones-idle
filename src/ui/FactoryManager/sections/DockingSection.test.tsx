import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DockingSection } from './DockingSection';
import { createMockFactory } from './testHelpers';

describe('DockingSection', () => {
  it('renders docking information with correct status indicators', () => {
    const factory = createMockFactory({
      queuedDrones: ['drone-1', 'drone-2', 'drone-3'],
      dockingCapacity: 2,
    });

    const { getByText, getAllByRole } = render(<DockingSection factory={factory} />);

    expect(getByText('Docking')).toBeDefined();
    expect(getByText('2/2 docks (1 waiting)')).toBeDefined();
    expect(getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows empty state when no drones queued', () => {
    const factory = createMockFactory({
      queuedDrones: [],
      dockingCapacity: 2,
    });

    const { getByText } = render(<DockingSection factory={factory} />);

    expect(getByText('No drones docked')).toBeDefined();
  });

  it('displays pagination controls when drones exceed page size', () => {
    const queuedDrones = Array.from({ length: 10 }, (_, i) => `drone-${i + 1}`);
    const factory = createMockFactory({
      queuedDrones,
      dockingCapacity: 2,
    });

    const { getAllByRole } = render(<DockingSection factory={factory} />);

    const buttons = getAllByRole('button');
    expect(
      buttons.some((b) => b.getAttribute('aria-label') === 'Previous docking page'),
    ).toBeTruthy();
    expect(buttons.some((b) => b.getAttribute('aria-label') === 'Next docking page')).toBeTruthy();
  });
});
