import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { getBridge, isBridgeReady } from '@/lib/rustBridgeRegistry';
import { FactoryModel } from './FactoryModel';
import { FactoryTransferFX } from './FactoryTransferFX';

export const Factory = () => {
  const factories = useStore((state) => state.factories);
  const useRustSim = useStore((state) => state.settings.useRustSim);

  const renderFactories = useMemo(() => {
    if (!useRustSim || !isBridgeReady()) {
      return factories;
    }
    const bridge = getBridge();
    if (!bridge) return factories;
    try {
      const positions = bridge.getFactoryPositions();
      const resources = bridge.getFactoryResources();
      const energy = bridge.getFactoryEnergy();
      const maxEnergy = bridge.getFactoryMaxEnergy();
      const haulers = bridge.getFactoryHaulersAssigned();
      const count = Math.min(factories.length, Math.floor(positions.length / 3));

      return factories.slice(0, count).map((factory, idx) => {
        const posIndex = idx * 3;
        const resIndex = idx * 7;
        const position = factory.position.clone();
        if (positions[posIndex] !== undefined) position.x = positions[posIndex];
        if (positions[posIndex + 1] !== undefined) position.y = positions[posIndex + 1];
        if (positions[posIndex + 2] !== undefined) position.z = positions[posIndex + 2];
        return {
          ...factory,
          position,
          energy: energy[idx] ?? factory.energy,
          energyCapacity: maxEnergy[idx] ?? factory.energyCapacity,
          resources: {
            ...factory.resources,
            ore: resources[resIndex] ?? factory.resources.ore,
            ice: resources[resIndex + 1] ?? factory.resources.ice,
            metals: resources[resIndex + 2] ?? factory.resources.metals,
            crystals: resources[resIndex + 3] ?? factory.resources.crystals,
            organics: resources[resIndex + 4] ?? factory.resources.organics,
            bars: resources[resIndex + 5] ?? factory.resources.bars,
            credits: resources[resIndex + 6] ?? factory.resources.credits,
          },
          haulersAssigned: haulers[idx] ?? factory.haulersAssigned ?? 0,
        };
      });
    } catch (err) {
      console.warn('Failed to read factory buffers from Rust bridge', err);
      return factories;
    }
  }, [factories, useRustSim]);

  return (
    <>
      {renderFactories.map((factory) => (
        <FactoryModel key={factory.id} factory={factory} />
      ))}
      <FactoryTransferFX />
    </>
  );
};
