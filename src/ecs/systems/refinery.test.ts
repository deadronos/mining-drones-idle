import { describe, expect, it } from 'vitest';
import { createGameWorld } from '@/ecs/world';
import { createRefinerySystem } from '@/ecs/systems/refinery';
import { createStoreInstance, runRefineryStep } from '@/state/store';

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
    const world = createGameWorld(0);
    const store = setupStore();
    const mirrorStore = setupStore();
    const system = createRefinerySystem(world, store);
    const dt = 0.75;
    system(dt);
    runRefineryStep(mirrorStore, dt);
    const systemResources = store.getState().resources;
    const mirrorResources = mirrorStore.getState().resources;
    expect(systemResources.bars).toBeCloseTo(mirrorResources.bars, 5);
    expect(systemResources.ore).toBeCloseTo(mirrorResources.ore, 5);
  });

  it('ignores non-positive timesteps', () => {
    const world = createGameWorld(0);
    const store = setupStore();
    const system = createRefinerySystem(world, store);
    const before = store.getState().resources;
    system(0);
    const after = store.getState().resources;
    expect(after).toEqual(before);
  });
});
