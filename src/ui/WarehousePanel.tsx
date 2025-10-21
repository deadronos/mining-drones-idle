import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { ResourceModifiersDebug } from '@/ui/ResourceModifiersDebug';
import { HaulerModulesPanel } from './HaulerModulesPanel';
import './WarehousePanel.css';

interface WarehousePanelProps {
  onOpenSettings: () => void;
}

interface ResourceDisplay {
  key: string;
  label: string;
  value: string;
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const formatDecimal = (value: number) => decimalFormatter.format(value);

const formatInteger = (value: number) => integerFormatter.format(value);

export const WarehousePanel = ({ onOpenSettings }: WarehousePanelProps) => {
  const ore = useStore((state) => state.resources.ore);
  const metals = useStore((state) => state.resources.metals);
  const crystals = useStore((state) => state.resources.crystals);
  const organics = useStore((state) => state.resources.organics);
  const ice = useStore((state) => state.resources.ice);
  const bars = useStore((state) => state.resources.bars);
  const energy = useStore((state) => state.resources.energy);
  const droneBay = useStore((state) => state.modules.droneBay);

  const entries = useMemo<ResourceDisplay[]>(
    () => [
      { key: 'ore', label: 'Ore', value: formatDecimal(ore) },
      { key: 'metals', label: 'Metals', value: formatDecimal(metals) },
      { key: 'crystals', label: 'Crystals', value: formatDecimal(crystals) },
      { key: 'organics', label: 'Organics', value: formatDecimal(organics) },
      { key: 'ice', label: 'Ice', value: formatDecimal(ice) },
      { key: 'bars', label: 'Bars', value: formatDecimal(bars) },
      { key: 'energy', label: 'Energy', value: formatInteger(energy) },
      { key: 'drones', label: 'Drones', value: formatInteger(droneBay) },
    ],
    [ore, metals, crystals, organics, ice, bars, energy, droneBay],
  );

  return (
    <aside className="warehouse-panel panel" aria-label="Warehouse overview">
      <header className="warehouse-panel__header">
        <div className="warehouse-panel__title-group">
          <h2 className="warehouse-panel__title">Warehouse</h2>
          <p className="warehouse-panel__subtitle">Global inventory ledger</p>
        </div>
      </header>

      <section className="warehouse-panel__section" aria-live="polite">
        <h3 className="warehouse-panel__section-title">Resources</h3>
        <dl className="warehouse-panel__resources">
          {entries.map((entry) => (
            <div key={entry.key} className="warehouse-panel__resource-row">
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <HaulerModulesPanel />

      <ResourceModifiersDebug
        className="warehouse-panel__bonuses"
        heading="Resource Bonuses"
        headingLevel="h3"
      />

      <div className="warehouse-panel__actions">
        <button type="button" className="warehouse-panel__settings" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </aside>
  );
};
