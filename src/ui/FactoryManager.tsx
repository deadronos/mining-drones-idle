import { useEffect, useMemo, useState } from 'react';
import { computeFactoryCost, type BuildableFactory } from '@/ecs/factories';
import {
  useStore,
  factoryUpgradeDefinitions,
  getFactoryUpgradeCost,
  getFactorySolarRegen,
  type FactoryUpgradeId,
} from '@/state/store';
import { computeHaulerCost } from '@/ecs/logistics';
import './FactoryManager.css';

const DOCKING_PAGE_SIZE = 6;
const ROSTER_PAGE_SIZE = 8;
const STORAGE_RESOURCE_ORDER: Array<keyof BuildableFactory['resources']> = [
  'ore',
  'bars',
  'metals',
  'crystals',
  'organics',
  'ice',
  'credits',
];

const STORAGE_LABELS: Record<keyof BuildableFactory['resources'], string> = {
  ore: 'Ore',
  bars: 'Bars',
  metals: 'Metals',
  crystals: 'Crystals',
  organics: 'Organics',
  ice: 'Ice',
  credits: 'Credits',
};

const WAREHOUSE_RESOURCE_ORDER: Array<
  'ore' | 'bars' | 'metals' | 'crystals' | 'organics' | 'ice' | 'energy' | 'credits'
> = ['ore', 'bars', 'metals', 'crystals', 'organics', 'ice', 'energy', 'credits'];

const WAREHOUSE_LABELS: Record<(typeof WAREHOUSE_RESOURCE_ORDER)[number], string> = {
  ore: 'Ore',
  bars: 'Bars',
  metals: 'Metals',
  crystals: 'Crystals',
  organics: 'Organics',
  ice: 'Ice',
  energy: 'Energy',
  credits: 'Credits',
};

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
  const warehouseEntries = useMemo(
    () =>
      WAREHOUSE_RESOURCE_ORDER.map((key) => ({
        key,
        label: WAREHOUSE_LABELS[key],
        amount: resources[key],
      })),
    [resources],
  );

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

      <section className="warehouse-summary">
        <h4>Warehouse Inventory</h4>
        <ul className="warehouse-list">
          {warehouseEntries.map(({ key, label, amount }) => (
            <li key={key} className={amount > 0 ? 'warehouse-row' : 'warehouse-row muted'}>
              <span className="warehouse-name">{label}</span>
              <span className="warehouse-value">{Math.floor(amount).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

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
  const [dockPage, setDockPage] = useState(0);
  const [rosterPage, setRosterPage] = useState(0);

  useEffect(() => {
    setDockPage(0);
    setRosterPage(0);
  }, [factory.id]);

  const dockingEntries = useMemo(
    () =>
      factory.queuedDrones.map((droneId, idx) => ({
        droneId,
        status: idx < factory.dockingCapacity ? 'docked' : 'waiting',
      })),
    [factory.queuedDrones, factory.dockingCapacity],
  );

  const totalDockPages = Math.max(1, Math.ceil(dockingEntries.length / DOCKING_PAGE_SIZE));

  useEffect(() => {
    setDockPage((current) => Math.min(current, totalDockPages - 1));
  }, [totalDockPages]);

  const safeDockPage = Math.min(dockPage, totalDockPages - 1);
  const dockStart = safeDockPage * DOCKING_PAGE_SIZE;
  const visibleDockEntries = dockingEntries.slice(dockStart, dockStart + DOCKING_PAGE_SIZE);

  const totalRosterPages = Math.max(1, Math.ceil(factory.ownedDrones.length / ROSTER_PAGE_SIZE));

  useEffect(() => {
    setRosterPage((current) => Math.min(current, totalRosterPages - 1));
  }, [totalRosterPages]);

  const safeRosterPage = Math.min(rosterPage, totalRosterPages - 1);
  const rosterStart = safeRosterPage * ROSTER_PAGE_SIZE;
  const visibleRoster = factory.ownedDrones.slice(rosterStart, rosterStart + ROSTER_PAGE_SIZE);

  const queueCount = factory.queuedDrones.length;
  const docked = Math.min(queueCount, factory.dockingCapacity);
  const waiting = Math.max(0, queueCount - docked);
  const energyPercent = factory.energyCapacity > 0 ? factory.energy / factory.energyCapacity : 0;
  const solarLevel = factory.upgrades?.solar ?? 0;
  const solarRegen = getFactorySolarRegen(solarLevel);

  const storageEntries = useMemo(() => {
    return STORAGE_RESOURCE_ORDER.map((key) => {
      const amount = factory.resources[key] ?? 0;
      const formattedAmount =
        key === 'ore'
          ? `${Math.floor(amount).toLocaleString()} / ${factory.storageCapacity.toLocaleString()}`
          : Math.floor(amount).toLocaleString();

      return {
        key,
        label: STORAGE_LABELS[key] ?? key,
        amount,
        display: formattedAmount,
      };
    });
  }, [factory.resources, factory.storageCapacity]);

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
            {visibleDockEntries.length === 0 ? (
              <li className="factory-queue-item empty">No drones docked</li>
            ) : (
              visibleDockEntries.map((entry) => (
                <li
                  key={entry.droneId}
                  className={`factory-queue-item${entry.status === 'waiting' ? ' waiting' : ''}`}
                >
                  {entry.status === 'waiting' ? '⏳' : '🛬'} {entry.droneId}
                </li>
              ))
            )}
          </ul>
          {totalDockPages > 1 ? (
            <div className="factory-pagination">
              <button
                type="button"
                className="factory-page-btn"
                onClick={() => setDockPage((page) => Math.max(0, page - 1))}
                disabled={safeDockPage === 0}
                aria-label="Previous docking page"
              >
                ◀
              </button>
              <span className="factory-page-indicator">
                {safeDockPage + 1} / {totalDockPages}
              </span>
              <button
                type="button"
                className="factory-page-btn"
                onClick={() => setDockPage((page) => Math.min(totalDockPages - 1, page + 1))}
                disabled={safeDockPage >= totalDockPages - 1}
                aria-label="Next docking page"
              >
                ▶
              </button>
            </div>
          ) : null}
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
          {solarRegen > 0 ? (
            <p className="muted" aria-label={`Solar regeneration ${solarRegen.toFixed(2)} per second`}>
              Solar regen: {solarRegen.toFixed(2)}/s
            </p>
          ) : null}
        </div>
        <div>
          <h4>Factory Storage</h4>
          <ul className="factory-storage-list">
            {storageEntries.map((entry) => (
              <li
                key={entry.key}
                className={entry.amount > 0 ? 'storage-row' : 'storage-row muted'}
                aria-label={`${entry.label}: ${entry.display}`}
              >
                <span className="storage-name">{entry.label}</span>
                <span className="storage-value">{entry.display}</span>
              </li>
            ))}
          </ul>
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
          <>
            <ul className="factory-roster-list">
              {visibleRoster.map((droneId) => (
                <li key={droneId}>{droneId}</li>
              ))}
            </ul>
            {totalRosterPages > 1 ? (
              <div className="factory-pagination roster">
                <button
                  type="button"
                  className="factory-page-btn"
                  onClick={() => setRosterPage((page) => Math.max(0, page - 1))}
                  disabled={safeRosterPage === 0}
                  aria-label="Previous owned drones page"
                >
                  ◀
                </button>
                <span className="factory-page-indicator">
                  {safeRosterPage + 1} / {totalRosterPages}
                </span>
                <button
                  type="button"
                  className="factory-page-btn"
                  onClick={() => setRosterPage((page) => Math.min(totalRosterPages - 1, page + 1))}
                  disabled={safeRosterPage >= totalRosterPages - 1}
                  aria-label="Next owned drones page"
                >
                  ▶
                </button>
              </div>
            ) : null}
          </>
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
              onClick={() => {
                const nextCost = computeHaulerCost(factory.haulersAssigned ?? 0);
                const canAfford = factory.resources.bars >= nextCost;
                if (canAfford) {
                  onAssignHaulers(factory.id, 1);
                }
              }}
              className="hauler-btn"
              aria-label="Add hauler"
              title={`Cost: ${Math.ceil(computeHaulerCost(factory.haulersAssigned ?? 0))} bars`}
              disabled={factory.resources.bars < computeHaulerCost(factory.haulersAssigned ?? 0)}
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
        {(() => {
          const nextCost = computeHaulerCost(factory.haulersAssigned ?? 0);
          return (factory.haulersAssigned ?? 0) > 0 ? (
            <div className="hauler-info">
              <p className="desc">
                This factory has {factory.haulersAssigned} hauler{factory.haulersAssigned === 1 ? '' : 's'} assigned.
              </p>
              <p className="next-cost">Next: {Math.ceil(nextCost)} bars</p>
            </div>
          ) : (
            <p className="muted small">
              Next: {Math.ceil(nextCost)} bars · Assign haulers to enable automatic resource transfers.
            </p>
          );
        })()}
      </section>
    </div>
  );
};
