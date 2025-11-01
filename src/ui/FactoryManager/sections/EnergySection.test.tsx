import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EnergySection } from './EnergySection';
import { createMockFactory } from './testHelpers';

describe('EnergySection', () => {
  it('renders energy display with capacity', () => {
    const factory = createMockFactory({
      energy: 150,
      energyCapacity: 200,
    });

    const { getByText } = render(<EnergySection factory={factory} />);

    expect(getByText('Energy')).toBeDefined();
    expect(getByText('150 / 200')).toBeDefined();
  });

  it('shows solar regen when solar upgrade is present', () => {
    const factory = createMockFactory({
      energy: 100,
      energyCapacity: 200,
      upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 1 },
    });

    const { getByText } = render(<EnergySection factory={factory} />);

    expect(getByText(/Solar regen:/)).toBeDefined();
  });

  it('shows base solar regen even at level 0', () => {
    const factory = createMockFactory({
      energy: 100,
      energyCapacity: 200,
      upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
    });

    const { getByText } = render(<EnergySection factory={factory} />);

    // Base regen of 1.25 should be visible at level 0 (updated gameplay)
    expect(getByText(/Solar regen:/)).toBeDefined();
    expect(getByText(/1.25\/s/)).toBeDefined();
  });
});
