import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';

/**
 * Create a mock factory for testing FactoryManager sections.
 * Provides a convenient way to create test factories with default or custom values.
 */
export const createMockFactory = (overrides?: Partial<BuildableFactory>): BuildableFactory => {
  const factory = createFactory('factory-1', new Vector3(0, 0, 0));
  return {
    ...factory,
    ...overrides,
  };
};
