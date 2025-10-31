import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { ResourceModifiersDebug } from '@/ui/ResourceModifiersDebug';
import { HaulerModulesPanel } from './HaulerModulesPanel';
import { SpecializationTechsPanel } from './SpecializationTechsPanel';
import { InvestmentBoardPanel } from './InvestmentBoardPanel';
import { formatDecimalOne, formatInteger } from '@/lib/formatters';
import './WarehousePanel.css';

interface WarehousePanelProps {
  onOpenSettings: () => void;
}

interface ResourceDisplay {
  key: string;
  label: string;
  value: string;
}

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
      { key: 'ore', label: 'Ore', value: formatDecimalOne(ore) },
      { key: 'metals', label: 'Metals', value: formatDecimalOne(metals) },
      { key: 'crystals', label: 'Crystals', value: formatDecimalOne(crystals) },
      { key: 'organics', label: 'Organics', value: formatDecimalOne(organics) },
      { key: 'ice', label: 'Ice', value: formatDecimalOne(ice) },
      { key: 'bars', label: 'Bars', value: formatDecimalOne(bars) },
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
        <button
          type="button"
          className="warehouse-panel__header-button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⚙️
        </button>
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

      <SpecializationTechsPanel />
      <InvestmentBoardPanel />

      <HaulerModulesPanel />

      <ResourceModifiersDebug
        className="warehouse-panel__bonuses"
        heading="Resource Bonuses"
        headingLevel="h3"
      />
    </aside>
  );
};
