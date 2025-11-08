import type { ChangeEventHandler, RefObject } from 'react';

import type { StoreSettings } from '@/state/types';

export const WarehousePrimerSection = () => (
  <section className="settings-section settings-section--wide">
    <h3>Warehouse Primer</h3>
    <p className="settings-note">
      Your warehouse is the global ledger for spendable inventory. It fuels prestige, module
      purchases, and exports when haulers find surplus at any factory.
    </p>
    <ul className="settings-note-list">
      <li>
        <strong>Warehouse totals</strong> are the numbers shown in the HUD and Upgrade
        panel—they rise only when haulers or unloads deliver to the warehouse.
      </li>
      <li>
        <strong>Factory storage</strong> is local working stock that keeps refineries
        running; haulers export excess above the buffer and import when a factory is
        starving.
      </li>
      <li>
        When resources look “missing,” check the selected factory card—if the buffer is
        full, haulers will route the overflow to the warehouse on their next run.
      </li>
    </ul>
  </section>
);

interface DebugSectionProps {
  settings: StoreSettings;
  onToggle: ChangeEventHandler<HTMLInputElement>;
}

export const DebugSettingsSection = ({ settings, onToggle }: DebugSectionProps) => (
  <section className="settings-section">
    <h3>Debug</h3>
    <p className="settings-note">
      Developer tools for inspecting runtime state. Toggle to show the floating debug panel.
    </p>
    <label className="settings-row">
      <span>
        Show debug panel
        <small>Enables a draggable debug overlay for troubleshooting (non-persistent tools).</small>
      </span>
      <input
        type="checkbox"
        checked={settings.showDebugPanel}
        onChange={onToggle}
        aria-label="Toggle debug panel"
      />
    </label>
  </section>
);

interface PersistenceSectionProps {
  settings: StoreSettings;
  onAutosaveToggle: ChangeEventHandler<HTMLInputElement>;
  onAutosaveInterval: ChangeEventHandler<HTMLInputElement>;
  onOfflineCap: ChangeEventHandler<HTMLInputElement>;
  onNotation: ChangeEventHandler<HTMLSelectElement>;
  onThrottle: ChangeEventHandler<HTMLInputElement>;
}

export const PersistenceSettingsSection = ({
  settings,
  onAutosaveToggle,
  onAutosaveInterval,
  onOfflineCap,
  onNotation,
  onThrottle,
}: PersistenceSectionProps) => (
  <section className="settings-section">
    <h3>Persistence</h3>
    <label className="settings-row">
      <span>
        Autosave
        <small>Automatically persist progress in the background.</small>
      </span>
      <input
        type="checkbox"
        checked={settings.autosaveEnabled}
        onChange={onAutosaveToggle}
        aria-label="Toggle autosave"
      />
    </label>
    <label className="settings-row">
      <span>
        Autosave interval (seconds)
        <small>Minimum 1 second.</small>
      </span>
      <input type="number" min={1} value={settings.autosaveInterval} onChange={onAutosaveInterval} />
    </label>
    <label className="settings-row">
      <span>
        Offline cap (hours)
        <small>Catch-up simulation will not exceed this duration.</small>
      </span>
      <input type="number" min={0} step={1} value={settings.offlineCapHours} onChange={onOfflineCap} />
    </label>
    <label className="settings-row">
      <span>
        Notation
        <small>Controls large-number formatting.</small>
      </span>
      <select value={settings.notation} onChange={onNotation}>
        <option value="standard">Standard</option>
        <option value="engineering">Engineering</option>
      </select>
    </label>
    <label className="settings-row">
      <span>
        Throttle floor
        <small>Minimum efficiency when energy-constrained.</small>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings.throttleFloor}
        onChange={onThrottle}
      />
      <span className="settings-value">{Math.round(settings.throttleFloor * 100)}%</span>
    </label>
  </section>
);

interface VisualSectionProps {
  settings: StoreSettings;
  onTrails: ChangeEventHandler<HTMLInputElement>;
  onHaulerShips: ChangeEventHandler<HTMLInputElement>;
  onPerformanceProfile: ChangeEventHandler<HTMLSelectElement>;
}

export const VisualSettingsSection = ({
  settings,
  onTrails,
  onHaulerShips,
  onPerformanceProfile,
}: VisualSectionProps) => (
  <section className="settings-section">
    <h3>Visuals</h3>
    <label className="settings-row">
      <span>
        Drone trails
        <small>Disable for performance on lower-end GPUs.</small>
      </span>
      <input type="checkbox" checked={settings.showTrails} onChange={onTrails} aria-label="Toggle drone trails" />
    </label>
    <label className="settings-row">
      <span>
        Hauler ships
        <small>Animated freighters replacing the legacy transfer lines.</small>
      </span>
      <input
        type="checkbox"
        checked={settings.showHaulerShips}
        onChange={onHaulerShips}
        aria-label="Toggle hauler ship visuals"
      />
    </label>
    <label className="settings-row">
      <span>
        Factory performance profile
        <small>Balance factory visual effects with your device capabilities.</small>
      </span>
      <select
        value={settings.performanceProfile}
        onChange={onPerformanceProfile}
        aria-label="Select factory performance profile"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </label>
  </section>
);

interface MetricsSectionProps {
  settings: StoreSettings;
  onMetricsToggle: ChangeEventHandler<HTMLInputElement>;
  onMetricsInterval: ChangeEventHandler<HTMLInputElement>;
  onMetricsRetention: ChangeEventHandler<HTMLInputElement>;
}

export const MetricsSettingsSection = ({
  settings,
  onMetricsToggle,
  onMetricsInterval,
  onMetricsRetention,
}: MetricsSectionProps) => (
  <section className="settings-section">
    <h3>Metrics</h3>
    <p className="settings-note">
      Lightweight factory metrics highlight short-term production trends. Low performance
      profile automatically slows sampling to protect frame rate.
    </p>
    <label className="settings-row">
      <span>
        Factory metrics
        <small>Pause or resume sampling without opening the factory panel.</small>
      </span>
      <input
        type="checkbox"
        checked={settings.metrics.enabled}
        onChange={onMetricsToggle}
        aria-label="Toggle factory metrics sampling"
      />
    </label>
    <label className="settings-row">
      <span>
        Sampling interval (seconds)
        <small>Minimum 1 second. Larger intervals reduce CPU cost.</small>
      </span>
      <input
        type="number"
        min={1}
        step={1}
        value={settings.metrics.intervalSeconds}
        onChange={onMetricsInterval}
      />
    </label>
    <label className="settings-row">
      <span>
        Retention window (seconds)
        <small>Minimum equals the interval. Controls sparkline history length.</small>
      </span>
      <input
        type="number"
        min={settings.metrics.intervalSeconds}
        step={1}
        value={settings.metrics.retentionSeconds}
        onChange={onMetricsRetention}
      />
    </label>
  </section>
);

interface DataToolsSectionProps {
  formattedLastSave: string;
  importError: string | null;
  onExport: () => void;
  onImport: ChangeEventHandler<HTMLInputElement>;
  onResetRequest: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export const DataToolsSection = ({
  formattedLastSave,
  importError,
  onExport,
  onImport,
  onResetRequest,
  fileInputRef,
}: DataToolsSectionProps) => (
  <section className="settings-section">
    <h3>Data tools</h3>
    <div className="settings-actions">
      <button type="button" onClick={onExport} aria-label="Export save data">
        Export JSON
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Import save data">
        Import JSON
      </button>
      <button type="button" onClick={onResetRequest} aria-label="Reset game progress">
        Reset Game
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={onImport}
        className="settings-file-input"
        aria-label="Import save file input"
      />
    </div>
    <p className="settings-meta">Last saved: {formattedLastSave}</p>
    {importError ? <p className="settings-error">{importError}</p> : null}
  </section>
);

interface ResetConfirmationDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const ResetConfirmationDialog = ({ onCancel, onConfirm }: ResetConfirmationDialogProps) => (
  <div className="settings-confirm-backdrop" role="presentation">
    <div
      className="settings-confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-confirm-title"
      aria-describedby="reset-confirm-description"
    >
      <h4 id="reset-confirm-title">Reset game progress?</h4>
      <p id="reset-confirm-description">
        This will erase all factories, resources, and progress. Export your save first if you want a
        backup.
      </p>
      <div className="settings-confirm-actions">
        <button type="button" onClick={onCancel} aria-label="Cancel reset">
          Cancel
        </button>
        <button type="button" className="settings-danger" onClick={onConfirm} aria-label="Confirm reset game">
          Reset Everything
        </button>
      </div>
    </div>
  </div>
);
