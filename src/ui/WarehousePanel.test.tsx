import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WarehousePanel } from './WarehousePanel';
import { storeApi, type Resources, type Modules } from '@/state/store';

describe('ui/WarehousePanel', () => {
  let originalResources: Resources;
  let originalModules: Modules;

  beforeEach(() => {
    const state = storeApi.getState();
    originalResources = { ...state.resources };
    originalModules = { ...state.modules };
  });

  afterEach(() => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        resources: { ...originalResources },
        modules: { ...originalModules },
      }));
    });
  });

  it('displays formatted warehouse resources and bonuses heading', () => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        resources: {
          ...state.resources,
          ore: 120.432,
          metals: 65.78,
          crystals: 44.1,
          organics: 33.333,
          ice: 87.9,
          bars: 12.49,
          energy: 2450.2,
        },
        modules: { ...state.modules, droneBay: 14 },
      }));
    });

    render(<WarehousePanel onOpenSettings={() => undefined} />);

    expect(screen.getByRole('heading', { name: /Warehouse/i })).toBeInTheDocument();
    expect(screen.getByText('Ore')).toBeInTheDocument();
    expect(screen.getByText('120.4')).toBeInTheDocument();
    expect(screen.getByText('Metals')).toBeInTheDocument();
    expect(screen.getByText('65.8')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('2,450')).toBeInTheDocument();
    expect(screen.getByText('Drones')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Resource Bonuses/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Logistics Modules/i })).toBeInTheDocument();
    expect(screen.getByText(/Network Capacity \+0/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Global hauler module help/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Global logistics modules apply automatically to every hauler. Use per-factory overrides/,
      ),
    ).toBeInTheDocument();
  });

  it('fires the provided settings callback when the button is clicked', () => {
    const onOpenSettings = vi.fn();
    render(<WarehousePanel onOpenSettings={onOpenSettings} />);

    const button = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(button);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
