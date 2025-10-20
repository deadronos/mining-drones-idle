import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RosterSection } from './RosterSection';
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

describe('RosterSection', () => {
  it('shows empty state when no owned drones', () => {
    const factory = createMockFactory({
      ownedDrones: [],
    });

    const { getByText } = render(<RosterSection factory={factory} />);

    expect(getByText('Owned Drones')).toBeDefined();
    expect(getByText('No drones assigned yet.')).toBeDefined();
  });

  it('displays owned drones in a list', () => {
    const factory = createMockFactory({
      ownedDrones: ['drone-1', 'drone-2', 'drone-3'],
    });

    const { getByText } = render(<RosterSection factory={factory} />);

    expect(getByText('Owned Drones')).toBeDefined();
    expect(getByText('drone-1')).toBeDefined();
    expect(getByText('drone-2')).toBeDefined();
    expect(getByText('drone-3')).toBeDefined();
  });

  it('shows pagination when drones exceed page size', () => {
    const ownedDrones = Array.from({ length: 10 }, (_, i) => `drone-${i + 1}`);
    const factory = createMockFactory({
      ownedDrones,
    });

    const { getAllByRole } = render(<RosterSection factory={factory} />);

    const buttons = getAllByRole('button');
    expect(
      buttons.some((b) => b.getAttribute('aria-label') === 'Previous owned drones page'),
    ).toBeTruthy();
    expect(
      buttons.some((b) => b.getAttribute('aria-label') === 'Next owned drones page'),
    ).toBeTruthy();
  });
});
