import type { BuildableFactory } from '@/ecs/factories';
import {
  getFactorySolarRegen,
  getSolarArrayLocalRegen,
  getFactoryEffectiveEnergyCapacity,
} from '@/state/store';
import { useStore } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import { formatInteger } from '@/lib/formatters';

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
  // Subscribe to resources and prestige for global modifiers
  const resources = useStore((s) => s.resources);
  const prestigeCores = useStore((s) => s.prestige.cores);
  const modifiers = getResourceModifiers(resources, prestigeCores);

  const collectorRegen = getFactorySolarRegen(solarCollectorLevel);
  const arrayBonusRegen = getSolarArrayLocalRegen(solarArrayLevel);
  const totalRegen = collectorRegen + arrayBonusRegen;

  // Use effective capacity (includes Solar Array bonus and global modifiers)
  const effectiveCapacity = getFactoryEffectiveEnergyCapacity(factory, solarArrayLevel, modifiers);
  const energyPercent = effectiveCapacity > 0 ? factory.energy / effectiveCapacity : 0;

  const globalRegenBonus =
    totalRegen > 0 ? totalRegen * (modifiers?.energyGenerationMultiplier - 1) : 0;

  return (
    <div>
      <h4>Energy</h4>
      <p>
        {formatInteger(Math.round(factory.energy))} /{' '}
        {formatInteger(Math.round(effectiveCapacity))}
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
          {globalRegenBonus > 0 && (
            <>
              <br />
              <small>* Global regen bonus: {globalRegenBonus.toFixed(2)}/s</small>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
};
