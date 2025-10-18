import { useCallback, useMemo } from 'react';
import { useStore } from '@/state/store';
import { computeFactoryCost } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';
import './FactoryManager.css';

/**
 * Factory Manager UI: displays existing factories and allows purchasing new ones.
 */
export const FactoryManager = () => {
  const factories = useStore((state) => state.factories);
  const resources = useStore((state) => state.resources);
  const purchaseFactory = useStore((state) => state.purchaseFactory);
  const toggleFactoryPinned = useStore((state) => state.toggleFactoryPinned);
  const triggerAutofit = useStore((state) => state.triggerFactoryAutofit);

  const factoryCount = factories.length;
  const nextCost = useMemo(() => computeFactoryCost(Math.max(0, factoryCount - 1)), [factoryCount]);

  const canAfford = useMemo(
    () => resources.metals >= nextCost.metals && resources.crystals >= nextCost.crystals,
    [resources, nextCost],
  );

  const handleBuyFactory = useCallback(() => {
    if (!canAfford) return;
    purchaseFactory();
  }, [canAfford, purchaseFactory]);

  return (
    <aside className="panel factory-panel">
      <h3>Factories</h3>
      <p>
        Owned: <strong>{factoryCount}</strong>
      </p>
      <div className="factory-actions">
        <button type="button" onClick={triggerAutofit} disabled={factoryCount === 0}>
          Autofit Camera
        </button>
      </div>

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
            <FactoryCard key={factory.id} factory={factory} onTogglePin={toggleFactoryPinned} />
          ))}
        </div>
      )}
    </aside>
  );
};

/**
 * Display a single factory's status (docking queue, active refines, storage).
 */
interface FactoryCardProps {
  factory: BuildableFactory;
  onTogglePin: (factoryId: string) => void;
}

const FactoryCard = ({ factory, onTogglePin }: FactoryCardProps) => {
  return (
    <div className="factory-card">
      <div className="header">
        <strong>{factory.id}</strong>
        <button
          type="button"
          className="pin-button"
          onClick={() => onTogglePin(factory.id)}
          aria-pressed={factory.pinned}
          aria-label={factory.pinned ? 'Unpin factory card' : 'Pin factory card'}
        >
          {factory.pinned ? '📌' : '📍'}
        </button>
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
