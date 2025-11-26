import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react';
import { useStore, type PerformanceProfile } from '@/state/store';
import type { PersistenceManager } from '@/state/persistence';
import type { MigrationReport } from '@/state/migrations';
import { useToast } from './ToastProvider';
import {
  WarehousePrimerSection,
  DebugSettingsSection,
  PersistenceSettingsSection,
  VisualSettingsSection,
  MetricsSettingsSection,
  DataToolsSection,
  ResetConfirmationDialog,
} from './settings/sections';

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

  const handleDebugPanelToggle: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ showDebugPanel: event.target.checked });
  };

  const handleRustSimToggle: ChangeEventHandler<HTMLInputElement> = (event) => {
    updateSettings({ useRustSim: event.target.checked });
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
          <WarehousePrimerSection />
          <DebugSettingsSection
            settings={settings}
            onToggle={handleDebugPanelToggle}
            onRustSimToggle={handleRustSimToggle}
          />
          <PersistenceSettingsSection
            settings={settings}
            onAutosaveToggle={handleAutosaveToggle}
            onAutosaveInterval={handleAutosaveInterval}
            onOfflineCap={handleOfflineCap}
            onNotation={handleNotation}
            onThrottle={handleThrottle}
          />
          <VisualSettingsSection
            settings={settings}
            onTrails={handleTrails}
            onHaulerShips={handleHaulerShips}
            onPerformanceProfile={handlePerformanceProfile}
          />
          <MetricsSettingsSection
            settings={settings}
            onMetricsToggle={handleMetricsToggle}
            onMetricsInterval={handleMetricsInterval}
            onMetricsRetention={handleMetricsRetention}
          />
          <DataToolsSection
            formattedLastSave={formattedLastSave}
            importError={importError}
            onExport={handleExport}
            onImport={handleImport}
            onResetRequest={handleResetRequest}
            fileInputRef={fileInputRef}
          />
        </div>
      </div>
      {confirmReset ? (
        <ResetConfirmationDialog onCancel={handleCancelReset} onConfirm={handleConfirmReset} />
      ) : null}
    </div>
  );
};

export type { SettingsPanelProps };
