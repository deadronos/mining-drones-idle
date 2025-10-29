import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react';
import { useStore, type PerformanceProfile } from '@/state/store';
import type { PersistenceManager } from '@/state/persistence';
import type { MigrationReport } from '@/state/migrations';
import { useToast } from './ToastProvider';

interface SettingsPanelProps {
  onClose: () => void;
  persistence: PersistenceManager;
}

const formatTimestamp = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
};

export const SettingsPanel = ({ onClose, persistence }: SettingsPanelProps) => {
  const settings = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);
  const resetGame = useStore((state) => state.resetGame);
  const lastSave = useStore((state) => state.save.lastSave);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const toastApi = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClose = useCallback(() => {
    setImportError(null);
    setConfirmReset(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirmReset) {
          setConfirmReset(false);
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, confirmReset]);

  const formattedLastSave = useMemo(() => formatTimestamp(lastSave), [lastSave]);

  const handleExport = () => {
    persistence.saveNow();
    const payload = persistence.exportState();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `space-factory-save-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void file
      .text()
      .then((content) => {
        // Prefer importStateWithReport when available so we can surface migration summaries
        const extendedPersistence = persistence as PersistenceManager & {
          importStateWithReport?: (payload: string) => {
            success: boolean;
            report?: MigrationReport;
          };
        };
        const reportResult = extendedPersistence.importStateWithReport?.(content);
        if (reportResult) {
          const { success, report } = reportResult;
          if (success) {
            setImportError(null);
            if (report?.migrated) {
              toastApi.push(
                `Imported and migrated save from ${report.fromVersion} → ${report.toVersion}. Applied: ${report.applied.join(', ')}`,
              );
            }
            handleClose();
            return;
          }
          setImportError('Save file format was not recognized.');
          return;
        }

        const success = persistence.importState(content);
        if (success) {
          setImportError(null);
          handleClose();
        } else {
          setImportError('Save file format was not recognized.');
        }
      })
      .catch((error) => {
        console.warn('Failed to import save file', error);
        setImportError('Unable to read the selected file.');
      });
  };

  const handleResetRequest = () => {
    setConfirmReset(true);
  };

  const handleCancelReset = () => {
    setConfirmReset(false);
  };

  const handleConfirmReset = () => {
    resetGame();
    persistence.saveNow();
    toastApi.push('Game reset. Fresh factories deployed.');
    setConfirmReset(false);
    setImportError(null);
    handleClose();
  };

  const handleAutosaveToggle: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ autosaveEnabled: event.target.checked });
  };

  const handleAutosaveInterval: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = Number(event.target.value);
    updateSettings({ autosaveInterval: Number.isFinite(next) ? next : settings.autosaveInterval });
  };

  const handleOfflineCap: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = Number(event.target.value);
    updateSettings({ offlineCapHours: Number.isFinite(next) ? next : settings.offlineCapHours });
  };

  const handleNotation: ChangeEventHandler<HTMLSelectElement> = (event) => {
    updateSettings({ notation: event.target.value as typeof settings.notation });
  };

  const handleThrottle: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = Number(event.target.value);
    updateSettings({ throttleFloor: Number.isFinite(next) ? next : settings.throttleFloor });
  };

  const handleTrails: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ showTrails: event.target.checked });
  };

  const handleHaulerShips: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ showHaulerShips: event.target.checked });
  };

  const handlePerformanceProfile: ChangeEventHandler<HTMLSelectElement> = (event) => {
    updateSettings({ performanceProfile: event.target.value as PerformanceProfile });
  };

  const handleMetricsToggle: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ metrics: { ...settings.metrics, enabled: event.target.checked } });
  };

  const handleMetricsInterval: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = Number(event.target.value);
    const intervalSeconds = Number.isFinite(next)
      ? Math.max(1, Math.floor(next))
      : settings.metrics.intervalSeconds;
    updateSettings({ metrics: { ...settings.metrics, intervalSeconds } });
  };

  const handleMetricsRetention: ChangeEventHandler<HTMLInputElement> = (event) => {
    const next = Number(event.target.value);
    const retentionSeconds = Number.isFinite(next)
      ? Math.max(settings.metrics.intervalSeconds, Math.floor(next))
      : settings.metrics.retentionSeconds;
    updateSettings({ metrics: { ...settings.metrics, retentionSeconds } });
  };

  return (
    <div className="settings-backdrop" role="presentation">
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p className="settings-subtitle">Control autosave, offline caps, and data tools.</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close settings">
            Close
          </button>
        </header>
        <div className="settings-content">
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
                onChange={handleAutosaveToggle}
                aria-label="Toggle autosave"
              />
            </label>
            <label className="settings-row">
              <span>
                Autosave interval (seconds)
                <small>Minimum 1 second.</small>
              </span>
              <input
                type="number"
                min={1}
                value={settings.autosaveInterval}
                onChange={handleAutosaveInterval}
              />
            </label>
            <label className="settings-row">
              <span>
                Offline cap (hours)
                <small>Catch-up simulation will not exceed this duration.</small>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={settings.offlineCapHours}
                onChange={handleOfflineCap}
              />
            </label>
            <label className="settings-row">
              <span>
                Notation
                <small>Controls large-number formatting.</small>
              </span>
              <select value={settings.notation} onChange={handleNotation}>
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
                onChange={handleThrottle}
              />
              <span className="settings-value">{Math.round(settings.throttleFloor * 100)}%</span>
            </label>
          </section>
          <section className="settings-section">
            <h3>Visuals</h3>
            <label className="settings-row">
              <span>
                Drone trails
                <small>Disable for performance on lower-end GPUs.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.showTrails}
                onChange={handleTrails}
                aria-label="Toggle drone trails"
              />
            </label>
            <label className="settings-row">
              <span>
                Hauler ships
                <small>Animated freighters replacing the legacy transfer lines.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.showHaulerShips}
                onChange={handleHaulerShips}
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
                onChange={handlePerformanceProfile}
                aria-label="Select factory performance profile"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </section>
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
                onChange={handleMetricsToggle}
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
                onChange={handleMetricsInterval}
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
                onChange={handleMetricsRetention}
              />
            </label>
          </section>
          <section className="settings-section">
            <h3>Data tools</h3>
            <div className="settings-actions">
              <button type="button" onClick={handleExport} aria-label="Export save data">
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import save data"
              >
                Import JSON
              </button>
              <button type="button" onClick={handleResetRequest} aria-label="Reset game progress">
                Reset Game
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="settings-file-input"
                aria-label="Import save file input"
              />
            </div>
            <p className="settings-meta">Last saved: {formattedLastSave}</p>
            {importError ? <p className="settings-error">{importError}</p> : null}
          </section>
        </div>
      </div>
      {confirmReset ? (
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
              This will erase all factories, resources, and progress. Export your save first if you
              want a backup.
            </p>
            <div className="settings-confirm-actions">
              <button type="button" onClick={handleCancelReset} aria-label="Cancel reset">
                Cancel
              </button>
              <button
                type="button"
                className="settings-danger"
                onClick={handleConfirmReset}
                aria-label="Confirm reset game"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export type { SettingsPanelProps };
