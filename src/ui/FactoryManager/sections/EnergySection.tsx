import type { BuildableFactory } from '@/ecs/factories';
import {
  getFactorySolarRegen,
  getSolarArrayLocalRegen,
  getFactoryEffectiveEnergyCapacity,
} from '@/state/store';
import { useStore } from '@/state/store';

interface EnergySectionProps {
  factory: BuildableFactory;
}

/**
 * EnergySection: Displays energy bar and solar regeneration status.
 */
/**
 * EnergySection: Displays energy bar and solar regeneration status.
 */
export const EnergySection = ({ factory }: EnergySectionProps) => {
  // Subscribe to full state to ensure modules are loaded
  const allModules = useStore((s) => s.modules);
  const solarCollectorLevel = factory.upgrades?.solar ?? 0;
  const solarArrayLevel = allModules.solar ?? 0;

  // Use effective capacity (includes Solar Array bonus)
  const effectiveCapacity = getFactoryEffectiveEnergyCapacity(factory, solarArrayLevel);
  const energyPercent = effectiveCapacity > 0 ? factory.energy / effectiveCapacity : 0;

  const collectorRegen = getFactorySolarRegen(solarCollectorLevel);
  const arrayBonusRegen = getSolarArrayLocalRegen(solarArrayLevel);
  const totalRegen = collectorRegen + arrayBonusRegen;

  return (
    <div>
      <h4>Energy</h4>
      <p>
        {Math.round(factory.energy).toLocaleString()} /{' '}
        {Math.round(effectiveCapacity).toLocaleString()}
      </p>
      <div className="factory-bar">
        <div
          className="factory-bar-fill"
          style={{ width: `${Math.min(1, energyPercent) * 100}%` }}
        />
      </div>
      {totalRegen > 0 ? (
        <p className="muted" aria-label={`Solar regeneration ${totalRegen.toFixed(2)} per second`}>
          Solar regen: {collectorRegen.toFixed(2)}/s
          {solarArrayLevel > 0 && (
            <>
              {' '}
              + {arrayBonusRegen.toFixed(2)}/s (Array L{solarArrayLevel})
            </>
          )}
        </p>
      ) : null}
    </div>
  );
};
