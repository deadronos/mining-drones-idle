import { useMemo } from 'react';
import { useStore } from '../state/store';
import type { RustSimBridge } from '../lib/wasmSimBridge';
import { gameWorld } from '@/ecs/world';

export interface DroneSimData {
  id: string;
  position: [number, number, number];
  state: number;
  cargo: number;
  battery: number;
  maxBattery: number;
  targetAsteroidIndex: number;
  targetFactoryIndex: number;
  ownerFactoryIndex: number;
}

export interface AsteroidSimData {
  id: string;
  position: [number, number, number];
  oreRemaining: number;
  maxOre: number;
}

export interface FactorySimData {
  id: string;
  position: [number, number, number];
  energy: number;
  maxEnergy: number;
  resources: {
    ore: number;
    ice: number;
    metals: number;
    crystals: number;
    organics: number;
    bars: number;
    credits: number;
  };
}

export interface SimulationDataSource {
  getDrones(): DroneSimData[];
  getAsteroids(): AsteroidSimData[];
  getFactories(): FactorySimData[];
  isRustActive: boolean;
}

/**
 * Abstraction hook that provides simulation data from either
 * Rust WASM or TypeScript ECS, based on feature flag.
 */
export function useSimulationData(bridge: RustSimBridge | null): SimulationDataSource {
  const useRustSim = useStore((state) => state.settings.useRustSim);
  const factories = useStore((state) => state.factories);

  const isRustActive = useRustSim && bridge?.isReady() === true;

  return useMemo(() => {
    if (isRustActive && bridge) {
      // Read from Rust buffers
      return {
        getDrones(): DroneSimData[] {
          const positions = bridge.getDronePositions();
          const states = bridge.getDroneStates();
          const cargo = bridge.getDroneCargo();
          const battery = bridge.getDroneBattery();
          const maxBattery = bridge.getDroneMaxBattery();
          const targetAsteroid = bridge.getDroneTargetAsteroidIndex();
          const targetFactory = bridge.getDroneTargetFactoryIndex();
          const ownerFactory = bridge.getDroneOwnerFactoryIndex();

          const droneCount = states.length;
          const result: DroneSimData[] = [];

          for (let i = 0; i < droneCount; i++) {
            result.push({
              id: `drone-${i}`,
              position: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
              state: states[i],
              cargo: cargo[i],
              battery: battery[i],
              maxBattery: maxBattery[i],
              targetAsteroidIndex: targetAsteroid[i],
              targetFactoryIndex: targetFactory[i],
              ownerFactoryIndex: ownerFactory[i],
            });
          }
          return result;
        },

        getAsteroids(): AsteroidSimData[] {
          const positions = bridge.getAsteroidPositions();
          const oreRemaining = bridge.getAsteroidOre();
          const maxOre = bridge.getAsteroidMaxOre();

          const asteroidCount = oreRemaining.length;
          const result: AsteroidSimData[] = [];

          for (let i = 0; i < asteroidCount; i++) {
            result.push({
              id: `asteroid-${i}`,
              position: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
              oreRemaining: oreRemaining[i],
              maxOre: maxOre[i],
            });
          }
          return result;
        },

        getFactories(): FactorySimData[] {
          const positions = bridge.getFactoryPositions();
          const energy = bridge.getFactoryEnergy();
          const maxEnergy = bridge.getFactoryMaxEnergy();
          const resources = bridge.getFactoryResources();

          const factoryCount = energy.length;
          const result: FactorySimData[] = [];

          for (let i = 0; i < factoryCount; i++) {
            const resBase = i * 7;
            result.push({
              id: factories[i]?.id ?? `factory-${i}`,
              position: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
              energy: energy[i],
              maxEnergy: maxEnergy[i],
              resources: {
                ore: resources[resBase],
                ice: resources[resBase + 1],
                metals: resources[resBase + 2],
                crystals: resources[resBase + 3],
                organics: resources[resBase + 4],
                bars: resources[resBase + 5],
                credits: resources[resBase + 6],
              },
            });
          }
          return result;
        },

        isRustActive: true,
      };
    }

    // TypeScript ECS fallback
    return {
      getDrones(): DroneSimData[] {
        return gameWorld.droneQuery.entities.map((entity) => ({
          id: entity.id,
          position: [entity.position.x, entity.position.y, entity.position.z],
          state: ['idle', 'toAsteroid', 'mining', 'returning', 'unloading'].indexOf(entity.state),
          cargo: entity.cargo ?? 0,
          battery: entity.battery ?? 100,
          maxBattery: entity.maxBattery ?? 100,
          targetAsteroidIndex: -1, // Not directly mapped in TS ECS
          targetFactoryIndex: -1,
          ownerFactoryIndex: factories.findIndex((f) => f.id === entity.ownerFactoryId),
        }));
      },

      getAsteroids(): AsteroidSimData[] {
        return gameWorld.asteroidQuery.entities.map((entity) => ({
          id: entity.id,
          position: [entity.position.x, entity.position.y, entity.position.z],
          oreRemaining: entity.oreRemaining,
          maxOre: entity.oreRemaining, // TS ECS doesn't track maxOre separately
        }));
      },

      getFactories(): FactorySimData[] {
        return factories.map((factory) => ({
          id: factory.id,
          position: [factory.position.x, factory.position.y, factory.position.z],
          energy: factory.energy,
          maxEnergy: factory.energyCapacity,
          resources: {
            ore: factory.resources.ore,
            ice: factory.resources.ice,
            metals: factory.resources.metals,
            crystals: factory.resources.crystals,
            organics: factory.resources.organics,
            bars: factory.resources.bars,
            credits: factory.resources.credits,
          },
        }));
      },

      isRustActive: false,
    };
  }, [isRustActive, bridge, factories]);
}
