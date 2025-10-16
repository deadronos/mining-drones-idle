import { describe, expect, it } from 'vitest';
import { createTravelSystem } from '@/ecs/systems/travel';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';
import { Vector3 } from 'three';

const setupTravelScenario = () => {
  const world = createGameWorld({ asteroidCount: 0 });
  const store = createStoreInstance();
  const drone = spawnDrone(world);
  drone.state = 'toAsteroid';
  drone.travel = {
    from: drone.position.clone(),
    to: drone.position.clone().add(new Vector3(10, 0, 0)),
    elapsed: 0,
    duration: 1,
  };
  return { world, store, drone };
};

describe('ecs/systems/travel', () => {
  it('advances travel proportionally to available battery', () => {
    const { world, store, drone } = setupTravelScenario();
    drone.battery = drone.maxBattery / 4;
    store.setState((state) => ({
      settings: { ...state.settings, throttleFloor: 0.2 },
    }));

    const system = createTravelSystem(world, store);
    system(1);

    expect(drone.travel?.elapsed).toBeCloseTo(0.25, 5);
    expect(drone.battery).toBeCloseTo(drone.maxBattery / 4 - 0.3, 5);
  });

  it('applies throttle floor when battery is depleted', () => {
    const { world, store, drone } = setupTravelScenario();
    drone.battery = 0;
    store.setState((state) => ({
      settings: { ...state.settings, throttleFloor: 0.3 },
    }));

    const system = createTravelSystem(world, store);
    system(1);

    expect(drone.travel?.elapsed).toBeCloseTo(0.3, 5);
    expect(drone.battery).toBe(0);
  });
});
