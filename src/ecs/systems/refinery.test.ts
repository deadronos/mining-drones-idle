import { describe, expect, it } from 'vitest';
import { createGameWorld } from '@/ecs/world';
import { createRefinerySystem } from '@/ecs/systems/refinery';
import { createStoreInstance } from '@/state/store';

const setupStore = () => {
  const store = createStoreInstance();
  const state = store.getState();
  store.setState({
    resources: { ...state.resources, ore: 120, bars: 0 },
    modules: { ...state.modules, refinery: 3 },
    prestige: { ...state.prestige, cores: 5 },
  });
  return store;
};

describe('ecs/systems/refinery', () => {
  it('shares refinery math with offline processing', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = setupStore();
    const mirrorStore = setupStore();
    const system = createRefinerySystem(world, store);
    const dt = 0.75;
    system(dt);
    mirrorStore.getState().processRefinery(dt);
    const systemResources = store.getState().resources;
    const mirrorResources = mirrorStore.getState().resources;
    expect(systemResources.bars).toBeCloseTo(mirrorResources.bars, 5);
    expect(systemResources.ore).toBeCloseTo(mirrorResources.ore, 5);
    expect(world.factory.activity.processing).toBeCloseTo(1, 5);
    expect(world.factory.activity.boost).toBeGreaterThan(0.9);
    expect(world.factory.activity.throughput).toBeGreaterThan(1);
  });

  it('ignores non-positive timesteps', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = setupStore();
    const system = createRefinerySystem(world, store);
    const before = store.getState().resources;
    system(0);
    const after = store.getState().resources;
    expect(after).toEqual(before);
  });

  it('decays activity when no ore is processed', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = setupStore();
    const system = createRefinerySystem(world, store);
    system(0.5);
    store.setState((state) => ({ resources: { ...state.resources, ore: 0 } }));
    system(0.5);
    expect(world.factory.activity.processing).toBeLessThan(1);
    expect(world.factory.activity.boost).toBeLessThan(1);
  });
});
