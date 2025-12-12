import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import './ResourceModifiersDebug.css';

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

interface ResourceModifiersDebugProps {
  className?: string;
  heading?: string;
  headingLevel?: 'h3' | 'h4' | 'h5';
}

export const ResourceModifiersDebug = (props?: ResourceModifiersDebugProps) => {
  const { className, heading = 'Resource Bonuses', headingLevel = 'h4' } = props ?? {};
  const resources = useStore((state) => state.resources);
  const prestigeCores = useStore((state) => state.prestige.cores);
  const modifiers = useMemo(() => {
    const snapshot = getResourceModifiers(resources, prestigeCores);
    // Guard against invalid snapshots to avoid NaN displays
    if (!snapshot || typeof snapshot !== 'object') {
      return getResourceModifiers(
        {
          ore: 0,
          ice: 0,
          metals: 0,
          crystals: 0,
          organics: 0,
          bars: 0,
          energy: 0,
          credits: 0,
        },
        0 as never,
      );
    }
    return snapshot;
  }, [resources, prestigeCores]);

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

  const containerClass = ['resource-modifiers', className].filter(Boolean).join(' ');

  const headingElement = (() => {
    if (headingLevel === 'h3') {
      return <h3 className="resource-modifiers__title">{heading}</h3>;
    }
    if (headingLevel === 'h5') {
      return <h5 className="resource-modifiers__title">{heading}</h5>;
    }
    return <h4 className="resource-modifiers__title">{heading}</h4>;
  })();

  return (
    <section className={containerClass} aria-live="polite">
      {headingElement}
      <ul className="resource-modifiers__list">
        {entries.map((entry) => (
          <li key={entry.label} className="resource-modifiers__item" title={entry.tooltip}>
            <span className="resource-modifiers__label">{entry.label}</span>
            <span className="resource-modifiers__value">{formatDelta(entry.delta)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
