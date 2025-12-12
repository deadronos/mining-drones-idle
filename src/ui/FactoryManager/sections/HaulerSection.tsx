import type { BuildableFactory } from '@/ecs/factories';
import { computeHaulerCost } from '@/ecs/logistics';
import { useStore } from '@/state/store';
import type { FactoryHaulerUpgradeId } from '@/state/store';
import {
  getFactoryHaulerUpgradeCost,
  getFactoryHaulerUpgradeMaxLevel,
  resolveFactoryHaulerConfig,
} from '@/lib/haulerUpgrades';
import { formatCost, hasResources } from '../utils/upgradeFormatting';

const upgradeOrder: FactoryHaulerUpgradeId[] = ['capacityBoost', 'speedBoost', 'efficiencyBoost'];

interface HaulerSectionProps {
  factory: BuildableFactory;
  onAssignHaulers: (factoryId: string, count: number) => boolean;
}

/**
 * HaulerSection: Displays hauler assignment controls and logistics status.
 */
export const HaulerSection = ({ factory, onAssignHaulers }: HaulerSectionProps) => {
  const modules = useStore((state) => state.modules);
  const purchaseUpgrade = useStore((state) => state.purchaseFactoryHaulerUpgrade);
  const nextCost = computeHaulerCost(factory.haulersAssigned ?? 0);
  const canAffordNext = factory.resources.bars >= nextCost;
  const resolved = resolveFactoryHaulerConfig({
    baseConfig: factory.haulerConfig,
    modules,
    upgrades: factory.haulerUpgrades,
  });

  return (
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
            title={`Cost: ${Math.ceil(nextCost)} bars`}
            disabled={!canAffordNext}
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
        return (factory.haulersAssigned ?? 0) > 0 ? (
          <div className="hauler-info">
            <p className="desc">
              This factory has {factory.haulersAssigned} hauler
              {factory.haulersAssigned === 1 ? '' : 's'} assigned.
            </p>
            <p className="next-cost">Next: {Math.ceil(nextCost)} bars</p>
          </div>
        ) : (
          <p className="muted small">
            Next: {Math.ceil(nextCost)} bars · Assign haulers to enable automatic resource
            transfers.
          </p>
        );
      })()}

      <div className="hauler-config-summary">
        <p>
          Capacity: <strong>{Math.round(resolved.capacity)}</strong> · Speed:{' '}
          <strong>{resolved.speed.toFixed(2)}</strong> · Overhead:{' '}
          <strong>{resolved.pickupOverhead.toFixed(2)}s</strong>
        </p>
      </div>

      <div className="hauler-upgrades">
        <div className="hauler-upgrades__header">
          <h5>Per-Factory Upgrades</h5>
          <button
            type="button"
            className="hauler-upgrades__info-button"
            aria-label="Per-factory hauler override help"
            title="Per-factory overrides apply only to this factory and stack with your global Logistics Modules. Use them to specialize high-demand routes."
          >
            ⓘ
          </button>
        </div>
        <p className="hauler-upgrades__helper">
          Overrides stack on top of global modules but only boost this factory&rsquo;s haulers.
        </p>
        <ul>
          {upgradeOrder.map((upgradeId) => {
            const currentLevel = factory.haulerUpgrades?.[upgradeId] ?? 0;
            const maxLevel = getFactoryHaulerUpgradeMaxLevel(upgradeId);
            const nextLevel = currentLevel + 1;
            const isMaxed = currentLevel >= maxLevel;
            const cost = isMaxed ? null : getFactoryHaulerUpgradeCost(upgradeId, nextLevel);
            const affordable = cost && hasResources(factory, cost);

            let label = '';
            if (upgradeId === 'capacityBoost') {
              label = '+5 capacity per level';
            } else if (upgradeId === 'speedBoost') {
              label = '+0.1 speed per level';
            } else {
              label = '-5% overhead per level';
            }

            return (
              <li key={upgradeId} className="hauler-upgrade-row">
                <div>
                  <span className="hauler-upgrade-name">{upgradeId}</span>
                  <span className="hauler-upgrade-level">
                    Level {currentLevel}/{maxLevel}
                  </span>
                  <p className="hauler-upgrade-desc">{label}</p>
                </div>
                <div className="hauler-upgrade-actions">
                  {isMaxed ? (
                    <span className="hauler-upgrade-max">Maxed</span>
                  ) : (
                    <button
                      type="button"
                      className="hauler-upgrade-buy"
                      disabled={!affordable}
                      onClick={() => purchaseUpgrade(factory.id, upgradeId)}
                    >
                      {cost && formatCost(cost)}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
