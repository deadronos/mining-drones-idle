import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react';
import { useStore } from '@/state/store';
import type { PersistenceManager } from '@/state/persistence';
import { Toast } from './Toast';
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
  const lastSave = useStore((state) => state.save.lastSave);
  const [importError, setImportError] = useState<string | null>(null);
  const toastApi = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClose = useCallback(() => {
    setImportError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

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
        const anyPersistence = persistence as PersistenceManager & {
          importStateWithReport?: (payload: string) => { success: boolean; report?: any };
        };
            if (anyPersistence.importStateWithReport) {
          const { success, report } = anyPersistence.importStateWithReport(content);
          if (success) {
            setImportError(null);
            if (report && report.migrated) {
              toastApi.push(`Imported and migrated save from ${report.fromVersion} → ${report.toVersion}. Applied: ${report.applied.join(', ')}`);
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
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={Number(settings.throttleFloor.toFixed(2))}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </div>
          <p className="settings-meta">Last saved: {formattedLastSave}</p>
          {importError ? <p className="settings-error">{importError}</p> : null}
        </section>
  {/* global toasts are rendered by ToastProvider */}
      </div>
    </div>
  );
};

export type { SettingsPanelProps };
