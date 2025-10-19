import { useEffect, useMemo } from 'react';
import { computeFactoryCost, type BuildableFactory } from '@/ecs/factories';
import {
  useStore,
  factoryUpgradeDefinitions,
  getFactoryUpgradeCost,
  type FactoryUpgradeId,
} from '@/state/store';
import './FactoryManager.css';

const isFiniteCostEntry = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value !== 0;

const formatCost = (cost: Partial<Record<string, number>>) =>
  Object.entries(cost)
    .filter((entry): entry is [string, number] => isFiniteCostEntry(entry[1]))
    .map(([key, value]) => `${Math.ceil(value)} ${key}`)
    .join(' + ');

const hasResources = (factory: BuildableFactory, cost: Partial<Record<string, number>>) =>
  Object.entries(cost).every(([key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return true;
    }
    const ledgerValue = factory.resources[key as keyof BuildableFactory['resources']];
    return (ledgerValue ?? 0) >= value;
  });

/**
 * Factory Manager UI: selector-driven inspector with per-factory upgrades.
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
  const updateHaulerConfig = useStore((state) => state.updateHaulerConfig);
  const getLogisticsStatus = useStore((state) => state.getLogisticsStatus);

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

  const handleUpgrade = (upgradeId: FactoryUpgradeId) => {
    if (!selectedFactory) return;
    upgradeFactory(selectedFactory.id, upgradeId);
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

      {selectedFactory ? (
        <SelectedFactoryCard
          factory={selectedFactory}
          index={safeIndex}
          total={factoryCount}
          onPrev={() => cycleFactory(-1)}
          onNext={() => cycleFactory(1)}
          onUpgrade={handleUpgrade}
          onTogglePin={toggleFactoryPinned}
          onAssignHaulers={assignHaulers}
          onUpdateHaulerConfig={updateHaulerConfig}
          onGetLogisticsStatus={getLogisticsStatus}
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
  onUpgrade: (upgrade: FactoryUpgradeId) => void;
  onTogglePin: (factoryId: string) => void;
  onAssignHaulers: (factoryId: string, count: number) => boolean;
  onUpdateHaulerConfig: (factoryId: string, config: Record<string, unknown>) => void;
  onGetLogisticsStatus: (factoryId: string) => { haulersAssigned: number } | null;
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
  onUpdateHaulerConfig,
  onGetLogisticsStatus,
}: SelectedFactoryCardProps) => {
  const queueCount = factory.queuedDrones.length;
  const docked = Math.min(queueCount, factory.dockingCapacity);
  const waiting = Math.max(0, queueCount - docked);
  const energyPercent = factory.energyCapacity > 0 ? factory.energy / factory.energyCapacity : 0;

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

      <div className="factory-grid">
        <div>
          <h4>Docking</h4>
          <p>
            {docked}/{factory.dockingCapacity} docks
            {waiting > 0 ? ` (${waiting} waiting)` : ''}
          </p>
          <ul className="factory-queue">
            {factory.queuedDrones.slice(0, factory.dockingCapacity).map((droneId) => (
              <li key={droneId} className="factory-queue-item">
                🛬 {droneId}
              </li>
            ))}
            {factory.queuedDrones.slice(factory.dockingCapacity).map((droneId) => (
              <li key={droneId} className="factory-queue-item waiting">
                ⏳ {droneId}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Energy</h4>
          <p>
            {Math.round(factory.energy).toLocaleString()} /{' '}
            {factory.energyCapacity.toLocaleString()}
          </p>
          <div className="factory-bar">
            <div
              className="factory-bar-fill"
              style={{ width: `${Math.min(1, energyPercent) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <h4>Storage</h4>
          <p>
            {Math.floor(factory.currentStorage).toLocaleString()} /{' '}
            {factory.storageCapacity.toLocaleString()} ore
          </p>
          <p>{Math.floor(factory.resources.bars).toLocaleString()} bars ready</p>
        </div>
      </div>

      <section className="factory-upgrades">
        <h4>Upgrades</h4>
        {(
          Object.entries(factoryUpgradeDefinitions) as [
            FactoryUpgradeId,
            (typeof factoryUpgradeDefinitions)[FactoryUpgradeId],
          ][]
        ).map(([upgradeId, definition]) => {
          const level = factory.upgrades[upgradeId] ?? 0;
          const cost = getFactoryUpgradeCost(upgradeId, level);
          const affordable = hasResources(factory, cost);
          return (
            <div key={upgradeId} className="factory-upgrade-row">
              <div>
                <strong>{definition.label}</strong> <span className="muted">Lv {level}</span>
                <div className="desc">{definition.description}</div>
              </div>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => onUpgrade(upgradeId)}
                className="upgrade-button"
              >
                Upgrade ({formatCost(cost) || 'free'})
              </button>
            </div>
          );
        })}
      </section>

      <section className="factory-roster">
        <h4>Owned Drones</h4>
        {factory.ownedDrones.length === 0 ? (
          <p className="muted">No drones assigned yet.</p>
        ) : (
          <ul className="factory-roster-list">
            {factory.ownedDrones.map((droneId) => (
              <li key={droneId}>{droneId}</li>
            ))}
          </ul>
        )}
      </section>

      {factory.activeRefines.length > 0 && (
        <section className="factory-refines">
          <h4>Active Refining</h4>
          <ul>
            {factory.activeRefines.map((process) => (
              <li key={process.id}>
                {process.oreType} — {Math.round(process.progress * 100)}%
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="factory-haulers">
        <h4>Hauler Logistics</h4>
        <div className="hauler-controls">
          <div className="hauler-count">
            <span className="label">Assigned Haulers:</span>
            <span className="count">{factory.haulersAssigned ?? 0}</span>
          </div>
          <div className="hauler-buttons">
            <button
              type="button"
              onClick={() => onAssignHaulers(factory.id, 1)}
              className="hauler-btn"
              aria-label="Add hauler"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                const current = factory.haulersAssigned ?? 0;
                if (current > 0) {
                  onAssignHaulers(factory.id, -1);
                }
              }}
              className="hauler-btn"
              aria-label="Remove hauler"
              disabled={(factory.haulersAssigned ?? 0) === 0}
            >
              -
            </button>
          </div>
        </div>
        {(factory.haulersAssigned ?? 0) > 0 ? (
          <div className="hauler-info">
            <p className="desc">
              This factory has {factory.haulersAssigned} hauler{factory.haulersAssigned === 1 ? '' : 's'} assigned for
              resource redistribution.
            </p>
          </div>
        ) : (
          <p className="muted small">Assign haulers to enable automatic resource transfers to other factories.</p>
        )}
      </section>
    </div>
  );
};
