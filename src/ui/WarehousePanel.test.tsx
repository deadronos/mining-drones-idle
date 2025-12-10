import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WarehousePanel } from './WarehousePanel';
import { registerBridge, unregisterBridge } from '@/lib/rustBridgeRegistry';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import {
  storeApi,
  type Resources,
  type Modules,
  type SpecTechState,
  type SpecTechSpentState,
  type PrestigeInvestmentState,
} from '@/state/store';

describe('ui/WarehousePanel', () => {
  let originalResources: Resources;
  let originalModules: Modules;
  let originalSpecTechs: SpecTechState;
  let originalSpecTechSpent: SpecTechSpentState;
  let originalPrestigeInvestments: PrestigeInvestmentState;

  beforeEach(() => {
    const state = storeApi.getState();
    originalResources = { ...state.resources };
    originalModules = { ...state.modules };
    originalSpecTechs = { ...state.specTechs };
    originalSpecTechSpent = { ...state.specTechSpent };
    originalPrestigeInvestments = { ...state.prestigeInvestments };
  });

  afterEach(() => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        resources: { ...originalResources },
        modules: { ...originalModules },
        specTechs: { ...originalSpecTechs },
        specTechSpent: { ...originalSpecTechSpent },
        prestigeInvestments: { ...originalPrestigeInvestments },
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
    expect(screen.getByRole('heading', { name: /Specialization Techs/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Prestige Investment Board/i })).toBeInTheDocument();
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

  it('disables investment and specialization actions when locked or unaffordable', () => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        resources: { ...state.resources, metals: 0, crystals: 0, organics: 0, ice: 0 },
        specTechSpent: { ...state.specTechSpent, metals: 0 },
      }));
    });

    render(<WarehousePanel onOpenSettings={() => undefined} />);

    const [specializationButton, investmentButton] = screen.getAllByRole('button', {
      name: /Invest .*metals/i,
    });
    expect(investmentButton).toBeDisabled();
    expect(specializationButton).toBeDisabled();
  });

  it('displays bridge resources when useRustSim is enabled', async () => {
    vi.useFakeTimers();
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        settings: { ...state.settings, useRustSim: true },
        resources: {
          ...state.resources,
          ore: 0,
          ice: 0,
        },
      }));
    });

    const mockBridge = {
      isReady: () => true,
      getGlobalResources: () =>
        new Float32Array([111, 222, 333, 444, 555, 666, 777, 888]),
    } as unknown as RustSimBridge;
    registerBridge(mockBridge);

    render(<WarehousePanel onOpenSettings={() => undefined} />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('111.0')).toBeInTheDocument(); // Ore
    expect(screen.getByText('222.0')).toBeInTheDocument(); // Ice
    expect(screen.getByText('333.0')).toBeInTheDocument(); // Metals
    expect(screen.getByText('777')).toBeInTheDocument(); // Energy

    unregisterBridge();
    vi.useRealTimers();
  });
});
