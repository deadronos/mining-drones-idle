import { useEffect, useState } from 'react';
import { gameWorld } from '@/ecs/world';
import { useStore } from '@/state/store';
import { getBiomeDefinition, RESOURCE_KEYS, type ResourceKey } from '@/lib/biomes';

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  ore: 'Ore',
  metals: 'Metals',
  crystals: 'Crystals',
  organics: 'Organics',
  ice: 'Ice',
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatHazard = (id: string | undefined | null) => {
  if (!id) return 'Stable';
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
};

export const AsteroidInspector = () => {
  const [index, setIndex] = useState(0);
  const [, forceUpdate] = useState(0);
  const selectedAsteroidId = useStore((state) => state.selectedAsteroidId);
  const isCollapsed = useStore((state) => state.settings.inspectorCollapsed);
  const toggleInspector = useStore((state) => state.toggleInspector);

  useEffect(() => {
    const id = window.setInterval(() => {
      forceUpdate((value) => value + 1);
    }, 800);
    return () => window.clearInterval(id);
  }, [forceUpdate]);

  const asteroids = gameWorld.asteroidQuery.entities;
  const total = asteroids.length;

  // If an asteroid is selected, find its index; otherwise use navigation index
  let displayIndex = index;
  if (selectedAsteroidId && total > 0) {
    const selectedIdx = asteroids.findIndex((a) => a.id === selectedAsteroidId);
    if (selectedIdx !== -1) {
      displayIndex = selectedIdx;
    }
  }

  const safeIndex = total === 0 ? 0 : Math.min(displayIndex, total - 1);

  if (total === 0) {
    return (
      <div className="inspector-panel">
        <div className="inspector-header">
          <div>
            <h3>Asteroid Inspector</h3>
            <p className="inspector-subtitle">No asteroids detected</p>
          </div>
        </div>
        <p className="inspector-empty">Biomes will appear once scanners discover asteroids.</p>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="inspector-collapsed-bar">
        <button
          type="button"
          onClick={() => toggleInspector()}
          className="inspector-collapse-toggle"
          aria-label="Expand asteroid inspector"
        >
          ▲ Inspector
        </button>
        <span className="inspector-mini-info">
          {selectedAsteroidId ? `Selected: ${selectedAsteroidId}` : `${total} asteroids`}
        </span>
      </div>
    );
  }

  const current = asteroids[safeIndex];
  const biomeDef = getBiomeDefinition(current.biome.biomeId);
  const hazard = current.biome.hazard;
  const resourceEntries = RESOURCE_KEYS.map((key) => ({
    key,
    label: RESOURCE_LABELS[key],
    value: current.resourceProfile[key] ?? 0,
  })).sort((a, b) => b.value - a.value);

  const regions = current.regions ?? [];

  const handlePrev = () => {
    setIndex(total === 0 ? 0 : (safeIndex - 1 + total) % total);
  };

  const handleNext = () => {
    setIndex(total === 0 ? 0 : (safeIndex + 1) % total);
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <div>
          <h3>{biomeDef.name}</h3>
          <p className="inspector-subtitle">Asteroid {current.id}</p>
        </div>
        <div className="inspector-controls">
          <button type="button" onClick={handlePrev} aria-label="Previous asteroid">
            ◀
          </button>
          <span className="inspector-index">
            {Math.min(safeIndex + 1, total)} / {total}
          </span>
          <button type="button" onClick={handleNext} aria-label="Next asteroid">
            ▶
          </button>
          <button
            type="button"
            onClick={() => toggleInspector()}
            className="inspector-collapse-button"
            aria-label="Collapse asteroid inspector"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-row">
          <span className="inspector-label">Primary Biome</span>
          <div className="inspector-swatch" style={{ backgroundColor: biomeDef.palette.primary }} />
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Gravity</span>
          <span className="inspector-value">{current.gravityMultiplier.toFixed(2)}g</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Dominant Resource</span>
          <span className="inspector-value">{RESOURCE_LABELS[current.dominantResource]}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Hazard</span>
          <span className={`inspector-badge severity-${hazard?.severity ?? 'none'}`}>
            {formatHazard(hazard?.id)}
          </span>
        </div>
      </div>

      <div className="inspector-section">
        <span className="inspector-section-title">Resource Mix</span>
        <ul className="inspector-resources">
          {resourceEntries.slice(0, 3).map((entry) => (
            <li key={entry.key}>
              <span>{entry.label}</span>
              <span>{formatPercent(entry.value)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="inspector-section">
        <span className="inspector-section-title">Regions</span>
        {regions.length === 0 ? (
          <p className="inspector-empty">No fractures recorded.</p>
        ) : (
          <ul className="inspector-regions">
            {regions.map((region) => {
              const regionDef = getBiomeDefinition(region.biomeId);
              return (
                <li key={region.id} className="inspector-region">
                  <div className="inspector-region-header">
                    <div className="inspector-region-title">
                      <span className="inspector-region-color" style={{ backgroundColor: regionDef.palette.primary }} />
                      <span>{regionDef.name}</span>
                    </div>
                    <span>{formatPercent(region.weight)}</span>
                  </div>
                  <div className="inspector-region-meta">
                    <span>{region.gravityMultiplier.toFixed(2)}g</span>
                    <span>{RESOURCE_LABELS[region.dominantResource]}</span>
                    <span className={`inspector-badge severity-${region.hazard?.severity ?? 'none'}`}>
                      {formatHazard(region.hazard?.id)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
