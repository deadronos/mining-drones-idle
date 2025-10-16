import { describe, expect, it } from 'vitest';
import { createFleetSystem } from '@/ecs/systems/fleet';
import { createGameWorld } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';

describe('ecs/systems/fleet', () => {
  it('maintains drone count according to module level', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const system = createFleetSystem(world, store);
    system(0.1);
    expect(world.droneQuery.size).toBe(1);
    store.setState((state) => ({ modules: { ...state.modules, droneBay: 4 } }));
    system(0.1);
    expect(world.droneQuery.size).toBe(4);
    store.setState((state) => ({ modules: { ...state.modules, droneBay: 2 } }));
    system(0.1);
    expect(world.droneQuery.size).toBe(2);
  });
});
