import { useState, useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { FactoryManager } from '@/ui/FactoryManager';
import { LogisticsPanel } from '@/ui/LogisticsPanel';
import { SettingsPanel } from '@/ui/Settings';
import type { PersistenceManager } from '@/state/persistence';
import './styles.css';
import { ToastProvider } from '@/ui/ToastProvider';
import { AsteroidInspector } from '@/ui/AsteroidInspector';
import { WarehousePanel } from '@/ui/WarehousePanel';
import { DebugPanel } from '@/ui/DebugPanel';
import { SidebarSection } from '@/ui/SidebarSection';
import { useStore } from '@/state/store';

interface AppProps {
  persistence: PersistenceManager;
}

const DEFAULT_SIDEBAR_WIDTH = 340;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 480;

export const App = ({ persistence }: AppProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const resizeSide = useRef<'left' | 'right' | null>(null);
  const resizeStart = useRef({ x: 0, width: 0 });
  const showDebugPanel = useStore((s) => s.settings.showDebugPanel);

  useEffect(() => {
    // Signal to e2e tests that the app has mounted and initial persistence/load is complete.
    if (typeof window !== 'undefined') {
      window.__appReady = true;
    }
    // Do not unset `window.__appReady` on unmount — test harnesses rely on a stable flag.
  }, []);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizeSide.current) return;
      if (resizeSide.current === 'left') {
        const nextWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, resizeStart.current.width + (event.clientX - resizeStart.current.x)),
        );
        setLeftWidth(nextWidth);
        return;
      }
      const viewportWidth = window.innerWidth;
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeStart.current.width + (resizeStart.current.x - event.clientX)),
      );
      const maxAllowed = Math.max(MIN_SIDEBAR_WIDTH, viewportWidth - MIN_SIDEBAR_WIDTH * 2);
      setRightWidth(Math.min(nextWidth, maxAllowed));
    };

    const handleUp = () => {
      resizeSide.current = null;
      document.body.classList.remove('is-resizing');
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startResize = (side: 'left' | 'right') => (event: ReactMouseEvent<HTMLDivElement>) => {
    resizeSide.current = side;
    resizeStart.current = {
      x: event.clientX,
      width: side === 'left' ? leftWidth : rightWidth,
    };
    document.body.classList.add('is-resizing');
    event.preventDefault();
  };

  const leftSidebarWidth = leftCollapsed ? 'var(--sidebar-collapsed)' : `${leftWidth}px`;
  const rightSidebarWidth = rightCollapsed ? 'var(--sidebar-collapsed)' : `${rightWidth}px`;

  return (
    <ToastProvider>
      <div
        className={`app-shell ${leftCollapsed ? 'app-shell--left-collapsed' : ''} ${
          rightCollapsed ? 'app-shell--right-collapsed' : ''
        }`}
        style={
          {
            '--left-sidebar-width': leftSidebarWidth,
            '--right-sidebar-width': rightSidebarWidth,
          } as CSSProperties
        }
      >
        <aside
          className={`sidebar sidebar--left ${leftCollapsed ? 'sidebar--collapsed' : ''}`}
          aria-label="Primary navigation"
        >
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span className="sidebar-title__icon" aria-hidden="true">
                🛰️
              </span>
              <div className="sidebar-title__text">
                <span>Command Deck</span>
                <small>Orbital control</small>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setLeftCollapsed((value) => !value)}
              aria-label={leftCollapsed ? 'Expand command deck' : 'Collapse command deck'}
            >
              {leftCollapsed ? '→' : '←'}
            </button>
          </div>

          <div className="sidebar-content">
            <details className="sidebar-group" open>
              <summary className="sidebar-group__summary">Operations</summary>
              <div className="sidebar-group__content">
                <SidebarSection
                  title="Warehouse"
                  description="Global inventory, upgrades, and bonuses"
                >
                  <WarehousePanel onOpenSettings={() => setSettingsOpen(true)} />
                </SidebarSection>
              </div>
            </details>
          </div>
          {!leftCollapsed ? (
            <div
              className="sidebar-resizer sidebar-resizer--left"
              onMouseDown={startResize('left')}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left sidebar"
            />
          ) : null}
        </aside>

        <main className="scene-shell">
          <div className="scene-header">
            <div>
              <p className="scene-header__eyebrow">Mission Control</p>
              <h1 className="scene-header__title">Mining Drones Command Grid</h1>
            </div>
            <div className="scene-header__status">
              <div>
                <span className="scene-header__label">Simulation</span>
                <span className="scene-header__value">Realtime</span>
              </div>
              <div>
                <span className="scene-header__label">Sector</span>
                <span className="scene-header__value">Obsidian Belt</span>
              </div>
            </div>
          </div>

          <div className="scene-canvas">
            <Canvas shadows camera={{ position: [0, 9, 22], fov: 52 }}>
              <Scene />
            </Canvas>
          </div>

          <AsteroidInspector />
        </main>

        <aside
          className={`sidebar sidebar--right ${rightCollapsed ? 'sidebar--collapsed' : ''}`}
          aria-label="Operations panels"
        >
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span className="sidebar-title__icon" aria-hidden="true">
                📡
              </span>
              <div className="sidebar-title__text">
                <span>Operations</span>
                <small>Systems overview</small>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setRightCollapsed((value) => !value)}
              aria-label={rightCollapsed ? 'Expand operations sidebar' : 'Collapse operations sidebar'}
            >
              {rightCollapsed ? '←' : '→'}
            </button>
          </div>

          <div className="sidebar-content">
            <details className="sidebar-group" open>
              <summary className="sidebar-group__summary">Manufacturing</summary>
              <div className="sidebar-group__content">
                <SidebarSection title="Upgrades" description="Module and production tuning">
                  <UpgradePanel />
                </SidebarSection>
              </div>
            </details>

            <details className="sidebar-group" open>
              <summary className="sidebar-group__summary">Logistics</summary>
              <div className="sidebar-group__content">
                <SidebarSection
                  title="Logistics Board"
                  description="Routes, queues, and transfer status"
                >
                  <LogisticsPanel />
                </SidebarSection>
              </div>
            </details>

            <details className="sidebar-group" open>
              <summary className="sidebar-group__summary">Factories</summary>
              <div className="sidebar-group__content">
                <SidebarSection title="Factory Manager" description="Fleet assignments & output">
                  <FactoryManager />
                </SidebarSection>
              </div>
            </details>
          </div>
          {!rightCollapsed ? (
            <div
              className="sidebar-resizer sidebar-resizer--right"
              onMouseDown={startResize('right')}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right sidebar"
            />
          ) : null}
        </aside>

        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} persistence={persistence} />
        ) : null}
        {showDebugPanel ? <DebugPanel /> : null}
      </div>
    </ToastProvider>
  );
};

export default App;
