import { useEffect, useMemo, useState } from 'react';
import { computeFactoryCost, type BuildableFactory } from '@/ecs/factories';
import { useStore, type FactoryUpgradeCostVariantId, type FactoryUpgradeId } from '@/state/store';
import { DockingSection } from './sections/DockingSection';
import { EnergySection } from './sections/EnergySection';
import { StorageSection } from './sections/StorageSection';
import { UpgradeSection } from './sections/UpgradeSection';
import { HaulerSection } from './sections/HaulerSection';
import { RefineSection } from './sections/RefineSection';
import { FactoryMetricsTab } from '../FactoryMetricsTab';
import '../FactoryManager.css';

/**
 * Factory Manager UI: selector-driven inspector with per-factory upgrades.
 * Composes section sub-components for docking, energy, storage, upgrades, roster, and haulers.
 */
export const FactoryManager = () => {
  const factories = useStore((state) => state.factories);
  const resources = useStore((state) => state.resources);
  const selectedFactoryId = useStore((state) => state.selectedFactoryId);
  const setSelectedFactory = useStore((state) => state.setSelectedFactory);
  const cycleFactory = useStore((state) => state.cycleSelectedFactory);
  const purchaseFactory = useStore((state) => state.purchaseFactory);
  const upgradeFactory = useStore((state) => state.upgradeFactory);
  const toggleFactoryPinned = useStore((state) => state.toggleFactoryPinned);
  const triggerAutofit = useStore((state) => state.triggerFactoryAutofit);
  const resetCamera = useStore((state) => state.resetCamera);
  const assignHaulers = useStore((state) => state.assignHaulers);

  const factoryCount = factories.length;
  const nextCost = useMemo(() => computeFactoryCost(Math.max(0, factoryCount - 1)), [factoryCount]);

  const canAffordPurchase = useMemo(
    () => resources.metals >= nextCost.metals && resources.crystals >= nextCost.crystals,
    [resources, nextCost],
  );

  useEffect(() => {
    if (factoryCount === 0) {
      setSelectedFactory(null);
      return;
    }
    if (!selectedFactoryId || !factories.some((factory) => factory.id === selectedFactoryId)) {
      setSelectedFactory(factories[0]?.id ?? null);
    }
  }, [factoryCount, factories, selectedFactoryId, setSelectedFactory]);

  const selectedIndex = selectedFactoryId
    ? factories.findIndex((factory) => factory.id === selectedFactoryId)
    : 0;
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedFactory = factories[safeIndex] ?? null;

  const displayedFactory = selectedFactory;

  const handleUpgrade = (upgradeId: FactoryUpgradeId, variant?: FactoryUpgradeCostVariantId) => {
    if (!selectedFactory) return;
    upgradeFactory(selectedFactory.id, upgradeId, variant);
  };

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
        <button type="button" onClick={resetCamera}>
          Reset Camera
        </button>
      </div>

      <div className="factory-buy">
        <div className="cost">
          Cost: {nextCost.metals} metals + {nextCost.crystals} crystals
        </div>
        <button
          type="button"
          disabled={!canAffordPurchase}
          onClick={() => canAffordPurchase && purchaseFactory()}
          className="buy-factory-btn"
        >
          Buy Factory
        </button>
      </div>

      {displayedFactory ? (
        <SelectedFactoryCard
          factory={displayedFactory}
          index={safeIndex}
          total={factoryCount}
          onPrev={() => cycleFactory(-1)}
          onNext={() => cycleFactory(1)}
          onUpgrade={handleUpgrade}
          onTogglePin={toggleFactoryPinned}
          onAssignHaulers={assignHaulers}
        />
      ) : (
        <p className="factory-empty">Construct a factory to begin routing drones.</p>
      )}
    </aside>
  );
};

interface SelectedFactoryCardProps {
  factory: BuildableFactory;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onUpgrade: (upgrade: FactoryUpgradeId, variant?: FactoryUpgradeCostVariantId) => void;
  onTogglePin: (factoryId: string) => void;
  onAssignHaulers: (factoryId: string, count: number) => boolean;
}

const SelectedFactoryCard = ({
  factory,
  index,
  total,
  onPrev,
  onNext,
  onUpgrade,
  onTogglePin,
  onAssignHaulers,
}: SelectedFactoryCardProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics'>('overview');
  const isMetricsSelected = activeTab === 'metrics';

  return (
    <div className="factory-card selected">
      <div className="factory-card-header">
        <div className="factory-card-meta">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous factory"
            disabled={total <= 1}
          >
            ◀
          </button>
          <span className="factory-card-title">{factory.id}</span>
          <button type="button" onClick={onNext} aria-label="Next factory" disabled={total <= 1}>
            ▶
          </button>
          <span className="factory-card-index">
            {Math.min(index + 1, total)} / {total}
          </span>
        </div>
        <div className="factory-card-actions">
          <button
            type="button"
            className="pin-button"
            onClick={() => onTogglePin(factory.id)}
            aria-label={factory.pinned ? 'Unpin factory card' : 'Pin factory card'}
          >
            {factory.pinned ? '📌' : '📍'}
          </button>
        </div>
      </div>

      <div className="factory-card-tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'factory-card-tab factory-card-tab--active' : 'factory-card-tab'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={activeTab === 'metrics' ? 'factory-card-tab factory-card-tab--active' : 'factory-card-tab'}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
      </div>

      {isMetricsSelected ? (
        <FactoryMetricsTab factoryId={factory.id} />
      ) : (
        <>
          <div className="factory-grid">
            <DockingSection factory={factory} />
            <EnergySection factory={factory} />
            <StorageSection factory={factory} />
          </div>

          <UpgradeSection factory={factory} onUpgrade={onUpgrade} />

          <RefineSection factory={factory} />

          <HaulerSection factory={factory} onAssignHaulers={onAssignHaulers} />
        </>
      )}
    </div>
  );
};
