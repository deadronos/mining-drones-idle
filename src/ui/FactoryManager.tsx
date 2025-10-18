import { useCallback, useMemo } from 'react';
import { Vector3 } from 'three';
import { useStore } from '@/state/store';
import { createFactory, computeFactoryCost } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';
import './FactoryManager.css';

/**
 * Factory Manager UI: displays existing factories and allows purchasing new ones.
 */
export const FactoryManager = () => {
  const factories = useStore((state) => state.factories);
  const resources = useStore((state) => state.resources);
  const addFactory = useStore((state) => state.addFactory);

  const factoryCount = factories.length;
  const nextCost = useMemo(() => computeFactoryCost(factoryCount), [factoryCount]);

  const canAfford = useMemo(
    () => resources.metals >= nextCost.metals && resources.crystals >= nextCost.crystals,
    [resources, nextCost],
  );

  const handleBuyFactory = useCallback(() => {
    if (!canAfford) return;

    // Generate a new factory ID
    const id = `factory-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Place at origin for now; in full impl, would use a placement UI
    const position = new Vector3(0, 0, 0);
    const newFactory = createFactory(id, position);

    // Add to store (would deduct cost in real implementation)
    addFactory(newFactory);
  }, [canAfford, addFactory]);

  return (
    <div className="factory-manager">
      <h3>Factories</h3>
      <p>
        Owned: <strong>{factoryCount}</strong>
      </p>

      <div className="factory-buy">
        <div className="cost">
          Cost: {nextCost.metals} metals + {nextCost.crystals} crystals
        </div>
        <button
          type="button"
          disabled={!canAfford}
          onClick={handleBuyFactory}
          className="buy-factory-btn"
        >
          Buy Factory
        </button>
      </div>

      {factories.length > 0 && (
        <div className="factory-list">
          <h4>Active Factories</h4>
          {factories.map((factory) => (
            <FactoryCard key={factory.id} factory={factory} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Display a single factory's status (docking queue, active refines, storage).
 */
interface FactoryCardProps {
  factory: BuildableFactory;
}

const FactoryCard = ({ factory }: FactoryCardProps) => {
  return (
    <div className="factory-card">
      <div className="header">
        <strong>{factory.id}</strong>
        {factory.pinned && <span className="pinned-badge">📌</span>}
      </div>
      <div className="stats">
        <div>
          Docking: {factory.queuedDrones.length}/{factory.dockingCapacity}
        </div>
        <div>
          Refining: {factory.activeRefines.length}/{factory.refineSlots}
        </div>
        <div>
          Storage: {Math.floor(factory.currentStorage)}/{factory.storageCapacity} ore
        </div>
      </div>
      {factory.activeRefines.length > 0 && (
        <div className="refines">
          {factory.activeRefines.map((p) => (
            <div key={p.id} className="refine-item">
              {p.oreType}: {Math.round(p.progress * 100)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
