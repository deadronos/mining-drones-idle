import { describe, it, expect } from 'vitest';
import { createStoreInstance } from '../store';
import { getSpecTechUnlockProgress } from '../sinks';

describe('Specialization Tech Unlock Progression (P1 Codex Issue)', () => {
  it('unlocks ore magnet tech after accumulating 50k metals via spending', () => {
    const store = createStoreInstance();
    const api = store.getState();

    // Verify tech is initially locked
    let unlockProgress = getSpecTechUnlockProgress(api.specTechSpent, 'oreMagnet');
    expect(unlockProgress.unlocked).toBe(false);
    expect(unlockProgress.spent).toBe(0);

    // Simulate accumulating 50k metals spent on various purchases
    store.setState((state) => ({
      specTechSpent: {
        ...state.specTechSpent,
        metals: 50000,
      },
    }));

    // Now verify tech is unlocked
    const updated = store.getState();
    unlockProgress = getSpecTechUnlockProgress(updated.specTechSpent, 'oreMagnet');
    expect(unlockProgress.unlocked).toBe(true);
    expect(unlockProgress.spent).toBe(50000);

    // Verify we can purchase the tech now (baseCost is 8000)
    store.setState((state) => ({
      resources: { ...state.resources, metals: 10000 },
    }));
    const purchased = store.getState().purchaseSpecTech('oreMagnet');
    expect(purchased).toBe(true);
    expect(store.getState().specTechs.oreMagnet).toBe(1);
    expect(store.getState().specTechSpent.metals).toBe(50000 + 8000); // 50k unlock + 8k purchase
  });

  it('tracks metals spending from purchaseFactory calls', () => {
    const store = createStoreInstance();
    const initialSpent = store.getState().specTechSpent.metals ?? 0;

    // Purchase a factory (costs 20 metals + 10 crystals by default)
    store.setState((state) => ({
      resources: { ...state.resources, metals: 1000, crystals: 1000 },
    }));
    const purchased = store.getState().purchaseFactory();
    expect(purchased).toBe(true);

    // Verify metals and crystals spending is tracked
    const newSpent = store.getState().specTechSpent;
    expect(newSpent.metals ?? 0).toBeGreaterThan(initialSpent);
    expect(newSpent.crystals ?? 0).toBeGreaterThan(0);
  });

  it('tracks secondary resources spending from prestige investments', () => {
    const store = createStoreInstance();

    // Set up prestige cores and secondary resources
    store.setState((state) => ({
      prestige: { cores: 100 },
      resources: { ...state.resources, metals: 5000 },
    }));

    const initialSpent = store.getState().specTechSpent.metals ?? 0;

    // Invest in prestige (droneVelocity costs metals)
    const invested = store.getState().investPrestige('droneVelocity');
    expect(invested).toBe(true);

    // Verify spending is tracked
    const newSpent = store.getState().specTechSpent.metals ?? 0;
    expect(newSpent).toBeGreaterThan(initialSpent);
  });

  it('allows progression through multiple unlock tiers', () => {
    const store = createStoreInstance();

    // Set up sufficient metals for tier 1 unlock (baseCost=8000, costGrowth=1.28)
    store.setState((state) => ({
      specTechSpent: {
        ...state.specTechSpent,
        metals: 50000,
      },
      resources: { ...state.resources, metals: 50000 },
    }));

    // Purchase tier 1 (costs 8000)
    let purchased = store.getState().purchaseSpecTech('oreMagnet');
    expect(purchased).toBe(true);
    expect(store.getState().specTechs.oreMagnet).toBe(1);

    // Add more metals for tier 2 (costs 8000 * 1.28 ≈ 10240)
    store.setState((state) => ({
      resources: { ...state.resources, metals: 15000 },
    }));

    // Purchase tier 2
    purchased = store.getState().purchaseSpecTech('oreMagnet');
    expect(purchased).toBe(true);
    expect(store.getState().specTechs.oreMagnet).toBe(2);

    // Verify total spent includes all purchases
    const totalSpent = store.getState().specTechSpent.metals;
    expect(totalSpent).toBeGreaterThanOrEqual(50000 + 8000 + 10240);
  });

  it('tracks factory upgrade resource costs correctly', () => {
    const store = createStoreInstance();

    // Create a factory and add upgrade resources
    const api = store.getState();
    api.purchaseFactory();
    const factory = store.getState().factories[0];
    if (!factory) return;

    store.setState((state) => ({
      factories: state.factories.map((f) =>
        f.id === factory.id
          ? {
              ...f,
              resources: {
                ...f.resources,
                metals: 1000,
                crystals: 1000,
                organics: 1000,
                ice: 1000,
                ore: 10000,
                bars: 100,
              },
            }
          : f,
      ),
    }));

    const initialSpecTechSpent = store.getState().specTechSpent;

    // Upgrade a factory using metals variant
    const upgraded = store.getState().upgradeFactory(factory.id, 'docking', 'metals');
    expect(upgraded).toBe(true);

    // Verify metals spending is tracked in specTechSpent
    const newSpecTechSpent = store.getState().specTechSpent;
    expect(newSpecTechSpent.metals ?? 0).toBeGreaterThan(initialSpecTechSpent.metals ?? 0);
  });
});
