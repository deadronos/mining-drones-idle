import { describe, expect, it } from 'vitest';
import { createMiningSystem } from '@/ecs/systems/mining';
import { DRONE_ENERGY_COST } from '@/state/store';
import { createGameWorld, spawnAsteroid, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';

const setupMiningScenario = () => {
  const world = createGameWorld({ asteroidCount: 0 });
  const store = createStoreInstance();
  const asteroid = spawnAsteroid(world, 0);
  asteroid.oreRemaining = 1_000;
  const drone = spawnDrone(world);
  drone.state = 'mining';
  drone.targetId = asteroid.id;
  return { world, store, drone, asteroid };
};

describe('ecs/systems/mining', () => {
  it('scales mining progress by available battery fraction', () => {
    const { world, store, drone } = setupMiningScenario();
    drone.battery = drone.maxBattery / 2;
    store.setState((state) => ({
      settings: { ...state.settings, throttleFloor: 0.2 },
    }));

    const system = createMiningSystem(world, store);
    system(1);

    expect(drone.cargo).toBeCloseTo(3, 5);
    // Energy consumed = DRONE_ENERGY_COST * fraction(0.5) * dt
    const expectedConsumed = DRONE_ENERGY_COST * 0.5;
    expect(drone.battery).toBeCloseTo(drone.maxBattery / 2 - expectedConsumed, 5);
  });

  it('respects throttle floor when the battery is empty', () => {
    const { world, store, drone } = setupMiningScenario();
    drone.battery = 0;
    store.setState((state) => ({
      settings: { ...state.settings, throttleFloor: 0.25 },
    }));

    const system = createMiningSystem(world, store);
    system(1);

    expect(drone.cargo).toBeCloseTo(1.5, 5);
    expect(drone.battery).toBe(0);
  });

  it('halts mining when throttle floor is zero and the battery is empty', () => {
    const { world, store, drone } = setupMiningScenario();
    drone.battery = 0;
    store.setState((state) => ({
      settings: { ...state.settings, throttleFloor: 0 },
    }));

    const system = createMiningSystem(world, store);
    system(1);

    expect(drone.cargo).toBe(0);
  });

  it('reduces energy drain when ice modifiers are active', () => {
    const baseScenario = setupMiningScenario();
    baseScenario.drone.battery = baseScenario.drone.maxBattery;
    const baseSystem = createMiningSystem(baseScenario.world, baseScenario.store);
    baseSystem(1);
    const baseConsumed = baseScenario.drone.maxBattery - baseScenario.drone.battery;

    const reducedScenario = setupMiningScenario();
    reducedScenario.drone.battery = reducedScenario.drone.maxBattery;
    reducedScenario.store.setState((state) => ({
      resources: { ...state.resources, ice: 40 },
    }));
    const reducedSystem = createMiningSystem(reducedScenario.world, reducedScenario.store);
    reducedSystem(1);
    const reducedConsumed = reducedScenario.drone.maxBattery - reducedScenario.drone.battery;

    expect(reducedConsumed).toBeLessThan(baseConsumed);
  });
});
