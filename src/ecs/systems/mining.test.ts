import { describe, expect, it } from 'vitest';
import { createMiningSystem } from '@/ecs/systems/mining';
import { createGameWorld, spawnAsteroid, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';

const setupMiningScenario = () => {
  const world = createGameWorld(0);
  const store = createStoreInstance();
  const asteroid = spawnAsteroid(world, 0);
  asteroid.oreRemaining = 1_000;
  const drone = spawnDrone(world);
  drone.state = 'mining';
  drone.targetId = asteroid.id;
  return { world, store, drone, asteroid };
};

describe('ecs/systems/mining', () => {
  it('scales mining progress by throttle factor', () => {
    const { world, store, drone } = setupMiningScenario();
    store.setState((state) => ({
      resources: { ...state.resources, energy: 10 },
      settings: { ...state.settings, throttleFloor: 0.2 },
    }));

    const system = createMiningSystem(world, store);
    system(1);

    expect(drone.cargo).toBeCloseTo(1.2, 5);
  });

  it('halts mining when throttle resolves to zero', () => {
    const { world, store, drone } = setupMiningScenario();
    store.setState((state) => ({
      resources: { ...state.resources, energy: 0 },
      settings: { ...state.settings, throttleFloor: 0 },
    }));

    const system = createMiningSystem(world, store);
    system(1);

    expect(drone.cargo).toBe(0);
  });
});
