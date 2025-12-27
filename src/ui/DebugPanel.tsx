import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useStore } from '@/state/store';
import { usePagination } from '@/ui/FactoryManager/hooks/usePagination';
import { PaginationControls } from '@/ui/shared/PaginationControls';
import { isBridgeReady } from '@/lib/rustBridgeRegistry';
import './DebugPanel.css';

const DRONES_PAGE_SIZE = 12;

export const DebugPanel = () => {
  const droneFlightsRecord = useStore((s) => s.droneFlights);
  const unstickDrone = useStore((s) => s.unstickDrone);
  const clearDroneFlight = useStore((s) => s.clearDroneFlight);
  const useRustSim = useStore((s) => s.settings.useRustSim);
  const updateSettings = useStore((s) => s.updateSettings);

  const droneFlights = useMemo(() => Object.values(droneFlightsRecord), [droneFlightsRecord]);

  const { page, totalPages, currentItems, goNext, goPrev } = usePagination(
    droneFlights,
    DRONES_PAGE_SIZE,
  );

  const [activeTab, setActiveTab] = useState<'drones'>('drones');

  // Draggable position
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 16, top: 64 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 });

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      setPos({ left: Math.max(8, dragStart.current.left + dx), top: Math.max(8, dragStart.current.top + dy) });
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // update CSS variables for panel position (avoid inline JSX styles)
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.setProperty('--debug-panel-left', `${pos.left}px`);
      panelRef.current.style.setProperty('--debug-panel-top', `${pos.top}px`);
    }
  }, [pos]);

  const startDrag = (ev: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: ev.clientX, y: ev.clientY, left: pos.left, top: pos.top };
    ev.preventDefault();
  };

  const handleUnstick = (droneId: string) => {
    // Use store helper to forcefully remove ownership/queue entries and persist immediately
    unstickDrone(droneId);
    // Also clear any in-memory flight snapshot
    clearDroneFlight(droneId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = (globalThis as any) as Window & { __persistence?: { saveNow?: () => void } };
      if (win && typeof win.__persistence?.saveNow === 'function') {
        win.__persistence.saveNow();
      }
    } catch {
      // noop
    }
  };

  return (
    <div ref={panelRef} className="debug-panel" role="region" aria-label="Debug panel">
      <div className="debug-panel-header" onMouseDown={startDrag}>
        <div className="debug-panel-title">Debug</div>
        <div className="debug-panel-tabs">
          <button
            type="button"
            className={activeTab === 'drones' ? 'tab tab--active' : 'tab'}
            onClick={() => setActiveTab('drones')}
          >
            Drones
          </button>
        </div>
      </div>
      <div className="debug-panel-body">
        {activeTab === 'drones' ? (
          <div>
            <div className="debug-panel-list-header">
              <strong>ID</strong>
              <strong>State</strong>
              <strong>Target</strong>
              <strong>Travel</strong>
              <span />
            </div>
            <ul className="debug-panel-list">
              {currentItems.map((flight) => (
                <li key={flight.droneId} className="debug-panel-list-item">
                  <span className="col id">{flight.droneId}</span>
                  <span className="col state">{flight.state}</span>
                  <span className="col target">{flight.targetFactoryId ?? '-'}</span>
                  <span className="col travel">
                    {flight.travel ? `${Math.round((flight.travel.elapsed ?? 0) * 100) / 100}/${
                      flight.travel.duration ?? '-'
                    }s` : '-'}
                  </span>
                  <span className="col actions">
                    <button type="button" onClick={() => handleUnstick(flight.droneId)}>
                      Unstick
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onNextPage={goNext}
              onPrevPage={goPrev}
              className="debug-panel-pagination"
              ariaLabelPrefix="page"
            />

            <div className="debug-panel-section">
              <strong>Rust Engine</strong>
              <label className="debug-panel-toggle">
                <input
                  type="checkbox"
                  checked={useRustSim}
                  onChange={(e) => updateSettings({ useRustSim: e.target.checked })}
                />
                <span>Use Rust WASM Simulation</span>
              </label>
              <span className="debug-panel-status">
                {useRustSim ? (isBridgeReady() ? '✓ Active' : '⏳ Loading...') : '○ Disabled'}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DebugPanel;
