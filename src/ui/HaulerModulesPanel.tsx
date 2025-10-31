import { useMemo } from 'react';
import { useStore } from '@/state/store';
import type { HaulerModuleId } from '@/state/store';
import { haulerModuleDefinitions } from '@/state/constants';
import {
  getHaulerModuleBonuses,
  getHaulerModuleCost,
  getHaulerModuleMaxLevel,
} from '@/lib/haulerUpgrades';
import { formatCost } from '@/ui/FactoryManager/utils/upgradeFormatting';
import { formatPercentInteger } from '@/lib/formatters';

const moduleOrder: HaulerModuleId[] = ['haulerDepot', 'logisticsHub', 'routingProtocol'];

export const HaulerModulesPanel = () => {
  const modules = useStore((state) => state.modules);
  const resources = useStore((state) => state.resources);
  const purchase = useStore((state) => state.purchaseHaulerModule);

  const bonuses = useMemo(() => getHaulerModuleBonuses(modules), [modules]);

  return (
    <section className="hauler-modules" aria-label="Global hauler modules">
      <header className="hauler-modules__header">
        <h3 className="warehouse-panel__section-title">Logistics Modules</h3>
        <button
          type="button"
          className="hauler-modules__info-button"
          aria-label="Global hauler module help"
          title="Global Logistics Modules boost every hauler in your network. Factory overrides stack on top when set on an individual factory."
        >
          ⓘ
        </button>
      </header>
      <p className="hauler-modules__helper">
        Global logistics modules apply automatically to every hauler. Use per-factory overrides when
        you need a single factory to push beyond the global baseline.
      </p>
      <p className="hauler-modules__summary">
        Network Capacity +{bonuses.capacityBonus} • Speed ×{bonuses.speedMultiplier.toFixed(2)} •
        Overhead ×{bonuses.pickupOverheadMultiplier.toFixed(2)}
      </p>
      <ul className="hauler-modules__list">
        {moduleOrder.map((moduleId) => {
          const definition = haulerModuleDefinitions[moduleId];
          const level = modules[moduleId] ?? 0;
          const maxLevel = getHaulerModuleMaxLevel(moduleId);
          const isMaxed = level >= maxLevel;
          const nextCost = isMaxed ? null : getHaulerModuleCost(moduleId, level + 1);
          const affordable =
            nextCost &&
            Object.entries(nextCost).every(([resource, amount]) => {
              const key = resource as keyof typeof resources;
              return (resources[key] ?? 0) >= amount;
            });

          let effectDescription = '';
          if (moduleId === 'haulerDepot') {
            effectDescription = `+${level * 10} capacity, +${formatPercentInteger(level * 0.05)} speed`;
          } else if (moduleId === 'logisticsHub') {
            effectDescription = `-${formatPercentInteger(level * 0.1)} pickup/dropoff time`;
          } else {
            effectDescription = `+${formatPercentInteger(level * 0.02)} routing efficiency`;
          }

          return (
            <li key={moduleId} className="hauler-modules__item">
              <div className="hauler-modules__details">
                <div className="hauler-modules__label">
                  <span className="hauler-modules__name">{definition.label}</span>
                  <span className="hauler-modules__level">
                    Level {level}/{maxLevel}
                  </span>
                </div>
                <p className="hauler-modules__description">{definition.description}</p>
                <p className="hauler-modules__effect">{effectDescription}</p>
              </div>
              <div className="hauler-modules__actions">
                {isMaxed ? (
                  <span className="hauler-modules__max">Maxed</span>
                ) : (
                  <button
                    type="button"
                    className="hauler-modules__buy"
                    disabled={!affordable}
                    onClick={() => purchase(moduleId)}
                  >
                    Buy · {nextCost && formatCost(nextCost)}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
