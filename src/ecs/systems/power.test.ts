import { describe, expect, it } from 'vitest';
import { createPowerSystem } from '@/ecs/systems/power';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';

const addDrones = (world: ReturnType<typeof createGameWorld>, count: number) => {
  for (let index = 0; index < count; index += 1) {
    spawnDrone(world);
  }
};

describe('ecs/systems/power', () => {
  it('scales consumption by energy throttle to allow recovery', () => {
    const world = createGameWorld(0);
    addDrones(world, 4);
    const store = createStoreInstance();
    store.setState((state) => ({
      modules: { ...state.modules, droneBay: 4, solar: 0 },
      resources: { ...state.resources, energy: 10 },
      settings: { ...state.settings, throttleFloor: 0.25 },
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    expect(resources.energy).toBeCloseTo(13.8, 5);
  });

  it('maintains full consumption when energy is plentiful', () => {
    const world = createGameWorld(0);
    addDrones(world, 20);
    const store = createStoreInstance();
    store.setState((state) => ({
      modules: { ...state.modules, droneBay: 20, solar: 0 },
      resources: { ...state.resources, energy: 100 },
      settings: { ...state.settings, throttleFloor: 0.1 },
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    const generation = 5; // solar level 0 => 5 energy per second
    const consumption = 20 * 1.2; // twenty drones at full throttle
    expect(resources.energy).toBeCloseTo(100 + generation - consumption, 5);
  });
});
