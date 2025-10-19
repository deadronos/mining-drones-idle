import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '@/ui/Settings';
import { storeApi } from '@/state/store';
import type { PersistenceManager } from '@/state/persistence';
import { createFactory } from '@/ecs/factories';
import { Vector3 } from 'three';

const createPersistenceMock = () => {
  const persistence: PersistenceManager = {
    load: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    saveNow: vi.fn(),
    exportState: vi.fn(() => '{"mock":true}'),
    importState: vi.fn(() => true),
  };
  return persistence;
};

describe('ui/Settings', () => {
  let originalCreate: ((obj: Blob | MediaSource) => string) | undefined;
  let originalRevoke: ((url: string) => void) | undefined;

  beforeEach(() => {
    originalCreate =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL.bind(URL) : undefined;
    originalRevoke =
      typeof URL.revokeObjectURL === 'function' ? URL.revokeObjectURL.bind(URL) : undefined;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    storeApi.setState((state) => ({
      ...state,
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: true,
        performanceProfile: 'medium',
        inspectorCollapsed: false,
      },
      save: { ...state.save, lastSave: 1_700_000_000_000 },
    }));
  });

  afterEach(() => {
    if (originalCreate) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreate,
      });
    } else {
      delete (URL as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL;
    }
    if (originalRevoke) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevoke,
      });
    } else {
      delete (URL as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL;
    }
    vi.restoreAllMocks();
  });

  it('updates autosave settings through the form controls', () => {
    const persistence = createPersistenceMock();
    render(<SettingsPanel onClose={() => undefined} persistence={persistence} />);

    const toggle = screen.getByLabelText<HTMLInputElement>(/toggle autosave/i);
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(storeApi.getState().settings.autosaveEnabled).toBe(false);

    const intervalInput = screen.getByLabelText<HTMLInputElement>(/autosave interval/i);
    fireEvent.change(intervalInput, { target: { value: '37.8' } });
    expect(storeApi.getState().settings.autosaveInterval).toBe(37);
  });

  it('toggles drone trails visibility', () => {
    const persistence = createPersistenceMock();
    render(<SettingsPanel onClose={() => undefined} persistence={persistence} />);

    const toggle = screen.getByLabelText<HTMLInputElement>(/toggle drone trails/i);
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(storeApi.getState().settings.showTrails).toBe(false);
  });

  it('changes factory performance profile', () => {
    const persistence = createPersistenceMock();
    render(<SettingsPanel onClose={() => undefined} persistence={persistence} />);

    const select = screen.getByLabelText<HTMLSelectElement>(/factory performance profile/i);
    expect(select.value).toBe('medium');
    fireEvent.change(select, { target: { value: 'high' } });
    expect(storeApi.getState().settings.performanceProfile).toBe('high');
  });

  it('invokes persistence export workflow when exporting', () => {
    const persistence = createPersistenceMock();
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} persistence={persistence} />);

    const exportButton = screen.getByRole('button', { name: /export save data/i });
    fireEvent.click(exportButton);

    expect(persistence.saveNow).toHaveBeenCalledTimes(1);
    expect(persistence.exportState).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing the close button', () => {
    const persistence = createPersistenceMock();
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} persistence={persistence} />);

    fireEvent.click(screen.getByRole('button', { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('resets game state after confirmation', () => {
    const persistence = createPersistenceMock();
    storeApi.setState((state) => ({
      ...state,
      resources: { ...state.resources, ore: 123, bars: 45 },
      factories: [
        ...state.factories,
        createFactory('factory-test', new Vector3(12, 0, 0)),
      ],
    }));

    render(<SettingsPanel onClose={() => undefined} persistence={persistence} />);

    fireEvent.click(screen.getByRole('button', { name: /reset game/i }));
    expect(screen.getByRole('alertdialog', { name: /reset game progress/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm reset game/i }));

    expect(persistence.saveNow).toHaveBeenCalled();
    const state = storeApi.getState();
    expect(state.resources.ore).toBe(0);
    expect(state.resources.bars).toBe(0);
    expect(state.factories).toHaveLength(1);
  });
});
