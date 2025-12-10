import { createStoreInstance } from '@/state/store';
import { createGameWorld, resetEntityIdCounter, type GameWorld, resetWorld } from '@/ecs/world';
import type { StoreSnapshot, StoreApiType } from '@/state/types';
import { createRng } from '@/lib/rng';

import { createBiomeSystem } from '@/ecs/systems/biomes';
import { createFleetSystem } from '@/ecs/systems/fleet';
import { createAsteroidSystem } from '@/ecs/systems/asteroids';
import { createDroneAISystem } from '@/ecs/systems/droneAI';
import { createTravelSystem } from '@/ecs/systems/travel';
import { createMiningSystem } from '@/ecs/systems/mining';
import { createUnloadSystem } from '@/ecs/systems/unload';
import { createPowerSystem } from '@/ecs/systems/power';
import { createRefinerySystem } from '@/ecs/systems/refinery';

export interface ParityContext {
  store: StoreApiType;
  world: GameWorld;
  systems: {
    biomes: (dt: number) => void;
    fleet: (dt: number) => void;
    asteroids: (dt: number) => void;
    droneAI: (dt: number) => void;
    travel: (dt: number) => void;
    mining: (dt: number) => void;
    unload: (dt: number) => void;
    power: (dt: number) => void;
    refinery: (dt: number) => void;
  };
  step: (dt: number) => void;
}

export function createParityContext(snapshot: StoreSnapshot): ParityContext {
  resetEntityIdCounter();

  const store = createStoreInstance();
  store.setState({ rngSeed: snapshot.rngSeed });
  store.getState().applySnapshot(snapshot);

  const world = createGameWorld({ rng: createRng(snapshot.rngSeed ?? 0) });
  resetWorld(snapshot.rngSeed ?? 0);

  const systems = {
    biomes: createBiomeSystem(world),
    fleet: createFleetSystem(world, store),
    asteroids: createAsteroidSystem(world, store),
    droneAI: createDroneAISystem(world, store),
    travel: createTravelSystem(world, store),
    mining: createMiningSystem(world, store),
    unload: createUnloadSystem(world, store),
    power: createPowerSystem(world, store),
    refinery: createRefinerySystem(world, store),
  };

  systems.asteroids(0);
  systems.fleet(0);

  const step = (dt: number) => {
    systems.fleet(dt);
    systems.biomes(dt);
    systems.asteroids(dt);
    systems.droneAI(dt);
    systems.travel(dt);
    systems.mining(dt);
    systems.unload(dt);
    systems.power(dt);
    systems.refinery(dt);

    store.getState().processLogistics(dt);
    store.getState().processFactories(dt);

    store.setState((state) => ({ gameTime: state.gameTime + dt }));
  };

  return { store, world, systems, step };
}
