import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

const formatPercent = (value: number) => {
  const rounded = Math.round(value * 1000) / 10;
  if (Math.abs(rounded) < 0.05) {
    return '0.0%';
  }
  return `${rounded.toFixed(1)}%`;
};

const formatDelta = (delta: number) => {
  const rounded = Math.round(delta * 1000) / 10;
  if (Math.abs(rounded) < 0.05) {
    return '0.0%';
  }
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
};

export const ResourceModifiersDebug = () => {
  const resources = useStore((state) => state.resources);
  const prestigeCores = useStore((state) => state.prestige.cores);
  const modifiers = useMemo(
    () => getResourceModifiers(resources, prestigeCores),
    [resources, prestigeCores],
  );

  const entries = [
    {
      label: 'Drone Capacity',
      delta: modifiers.droneCapacityMultiplier - 1,
      tooltip: `Metals bonus ${formatPercent(modifiers.metalsBonus)} boosts cargo pods.`,
    },
    {
      label: 'Drone Battery',
      delta: modifiers.droneBatteryMultiplier - 1,
      tooltip: `Metals bonus ${formatPercent(modifiers.metalsBonus)} reinforces chassis.`,
    },
    {
      label: 'Refinery Yield',
      delta: modifiers.refineryYieldMultiplier - 1,
      tooltip: `Crystals bonus ${formatPercent(modifiers.crystalsBonus)} tunes refinement.`,
    },
    {
      label: 'Drone Output Speed',
      delta: modifiers.droneProductionSpeedMultiplier - 1,
      tooltip: `Organics bonus ${formatPercent(modifiers.organicsBonus)} accelerates fabrication.`,
    },
    {
      label: 'Energy Storage',
      delta: modifiers.energyStorageMultiplier - 1,
      tooltip: `Ice bonus ${formatPercent(modifiers.iceBonus)} expands capacitor banks.`,
    },
    {
      label: 'Energy Generation',
      delta: modifiers.energyGenerationMultiplier - 1,
      tooltip: `Organics bonus ${formatPercent(modifiers.organicsBonus)} boosts passive regen.`,
    },
    {
      label: 'Energy Drain',
      delta: modifiers.energyDrainMultiplier - 1,
      tooltip: `Ice bonus ${formatPercent(modifiers.iceBonus)} cools systems to reduce drain.`,
    },
  ];

  return (
    <div className="hud-modifiers" aria-live="polite">
      <h4>Resource Bonuses</h4>
      <ul className="hud-modifiers-list">
        {entries.map((entry) => (
          <li key={entry.label} className="hud-modifiers-item" title={entry.tooltip}>
            <span className="hud-modifiers-label">{entry.label}</span>
            <span className="hud-modifiers-value">{formatDelta(entry.delta)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
