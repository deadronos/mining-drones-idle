import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { getBridge, isBridgeReady } from '@/lib/rustBridgeRegistry';
import { FactoryModel } from './FactoryModel';
import { FactoryTransferFX } from './FactoryTransferFX';

export const Factory = () => {
  const factories = useStore((state) => state.factories);
  const useRustSim = useStore((state) => state.settings.useRustSim);

  const renderFactories = useMemo(() => {
    // Prefer authoritative store values for factory state (resources, energy, haulers).
    // Only read positions from the Rust bridge for smooth rendering updates.
    if (!useRustSim || !isBridgeReady()) {
      return factories;
    }
    const bridge = getBridge();
    if (!bridge) return factories;
    try {
      const positions = bridge.getFactoryPositions();
      const count = Math.min(factories.length, Math.floor(positions.length / 3));

      return factories.slice(0, count).map((factory, idx) => {
        const posIndex = idx * 3;
        const position = factory.position.clone();
        if (positions[posIndex] !== undefined) position.x = positions[posIndex];
        if (positions[posIndex + 1] !== undefined) position.y = positions[posIndex + 1];
        if (positions[posIndex + 2] !== undefined) position.z = positions[posIndex + 2];
        return {
          ...factory,
          position,
          // Keep energy, energyCapacity, resources, and hauler count from the store,
          // these are synchronized by Scene.tsx into the store regularly.
          energy: factory.energy,
          energyCapacity: factory.energyCapacity,
          resources: factory.resources,
          haulersAssigned: factory.haulersAssigned ?? 0,
        };
      });
    } catch (err) {
      console.warn('Failed to read factory positions from Rust bridge', err);
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
