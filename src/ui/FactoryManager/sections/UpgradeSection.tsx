import type { BuildableFactory } from '@/ecs/factories';
import { factoryUpgradeDefinitions, getFactoryUpgradeCost } from '@/state/store';
import type { FactoryUpgradeId } from '@/state/store';
import { formatCost, hasResources } from '../utils/upgradeFormatting';

interface UpgradeSectionProps {
  factory: BuildableFactory;
  onUpgrade: (upgrade: FactoryUpgradeId) => void;
}

/**
 * UpgradeSection: Displays available factory upgrades with costs and affordability.
 */
export const UpgradeSection = ({ factory, onUpgrade }: UpgradeSectionProps) => {
  return (
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
  );
};
