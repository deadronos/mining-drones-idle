import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EnergySection } from './EnergySection';
import { createFactory } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';
import { Vector3 } from 'three';

const createMockFactory = (overrides?: Partial<BuildableFactory>): BuildableFactory => {
  const factory = createFactory('factory-1', new Vector3(0, 0, 0));
  return {
    ...factory,
    ...overrides,
  };
};

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

    // Base regen of 0.25 should be visible at level 0
    expect(getByText(/Solar regen:/)).toBeDefined();
    expect(getByText(/0.25\/s/)).toBeDefined();
  });
});
