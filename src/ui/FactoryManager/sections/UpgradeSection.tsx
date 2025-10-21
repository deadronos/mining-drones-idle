import { useMemo, useState } from 'react';
import type { BuildableFactory } from '@/ecs/factories';
import {
  factoryUpgradeDefinitions,
  getFactoryUpgradeCost,
  type FactoryUpgradeCostVariantId,
} from '@/state/store';
import type { FactoryUpgradeId } from '@/state/store';
import { formatCost, hasResources } from '../utils/upgradeFormatting';

interface UpgradeSectionProps {
  factory: BuildableFactory;
  onUpgrade: (upgrade: FactoryUpgradeId, variant?: FactoryUpgradeCostVariantId) => void;
}

/**
 * UpgradeSection: Displays available factory upgrades with costs and affordability.
 */
export const UpgradeSection = ({ factory, onUpgrade }: UpgradeSectionProps) => {
  const [selectedVariants, setSelectedVariants] = useState<
    Partial<Record<FactoryUpgradeId, FactoryUpgradeCostVariantId>>
  >({});

  const variantOrder = useMemo<FactoryUpgradeCostVariantId[]>(
    () => ['bars', 'metals', 'crystals', 'organics', 'ice'],
    [],
  );

  const variantLabels: Record<FactoryUpgradeCostVariantId, string> = useMemo(
    () => ({
      bars: 'Bars',
      metals: 'Metals',
      crystals: 'Crystals',
      organics: 'Organics',
      ice: 'Ice',
    }),
    [],
  );

  const handleVariantChange = (
    upgradeId: FactoryUpgradeId,
    variant: FactoryUpgradeCostVariantId,
  ) => {
    setSelectedVariants((prev) => ({ ...prev, [upgradeId]: variant }));
  };

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
        const availableVariants = variantOrder.filter((variantId) => {
          if (variantId === 'bars') {
            return true;
          }
          return Boolean(definition.alternativeCosts?.[variantId]);
        });
        const fallbackVariant = availableVariants[0] ?? 'bars';
        const storedVariant = selectedVariants[upgradeId];
        const activeVariant =
          storedVariant && availableVariants.includes(storedVariant)
            ? storedVariant
            : fallbackVariant;
        const cost = getFactoryUpgradeCost(upgradeId, level, activeVariant);
        const affordable = hasResources(factory, cost);
        return (
          <div key={upgradeId} className="factory-upgrade-row">
            <div className="factory-upgrade-content">
              <strong>{definition.label}</strong> <span className="muted">Lv {level}</span>
              <div className="desc">{definition.description}</div>
              <label className="upgrade-variant">
                <span className="muted">Pay with</span>
                <select
                  value={activeVariant}
                  onChange={(event) =>
                    handleVariantChange(
                      upgradeId,
                      event.target.value as FactoryUpgradeCostVariantId,
                    )
                  }
                >
                  {availableVariants.map((variantId) => {
                    const variantCost = getFactoryUpgradeCost(upgradeId, level, variantId);
                    const label = variantLabels[variantId] ?? variantId;
                    return (
                      <option key={variantId} value={variantId}>
                        {label} ({formatCost(variantCost) || 'free'})
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className="factory-upgrade-actions">
              <button
                type="button"
                disabled={!affordable}
                onClick={() => onUpgrade(upgradeId, activeVariant)}
                className="upgrade-button"
              >
                Upgrade ({variantLabels[activeVariant] ?? activeVariant})
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
};
