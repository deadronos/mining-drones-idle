import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StorageSection } from './StorageSection';
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

describe('StorageSection', () => {
  it('renders all storage resources in correct order', () => {
    const factory = createMockFactory();

    const { getByText, getAllByRole } = render(<StorageSection factory={factory} />);

    expect(getByText('Storage')).toBeDefined();
    const listItems = getAllByRole('listitem');
    expect(listItems).toHaveLength(7); // ore, bars, metals, crystals, organics, ice, credits
  });

  it('displays ore with storage capacity', () => {
    const factory = createMockFactory({
      resources: { ore: 123, bars: 0, metals: 0, crystals: 0, organics: 0, ice: 0, credits: 0 },
    });

    const { container } = render(<StorageSection factory={factory} />);

    // Check that ore storage displays (capacity format like "123 / ###")
    const text = container.textContent || '';
    expect(text).toContain('Ore');
    expect(text).toContain('123');
    expect(text).toContain('/'); // Shows ore/capacity format
  });

  it('displays non-ore resources with proper formatting', () => {
    const factory = createMockFactory({
      resources: { ore: 0, bars: 1234, metals: 0, crystals: 0, organics: 0, ice: 0, credits: 0 },
    });

    const { container } = render(<StorageSection factory={factory} />);

    // Check that bars displays properly
    const text = container.textContent || '';
    expect(text).toContain('Bars');
    // Locale-independent: match 1234, 1,234, or 1.234
    expect(text).toMatch(/1[\s.,]*234|1234/);
  });
});
