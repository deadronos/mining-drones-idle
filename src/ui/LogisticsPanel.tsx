import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { WAREHOUSE_NODE_ID } from '@/ecs/logistics';
import { getHaulerModuleBonuses } from '@/lib/haulerUpgrades';
import { PaginationControls } from '@/ui/shared/PaginationControls';
import './LogisticsPanel.css';

const TRANSFERS_PAGE_SIZE = 5;

/**
 * Global Logistics Panel: overview of all factory transfers and hauler allocation
 */
export const LogisticsPanel = () => {
  const factories = useStore((state) => state.factories);
  const resources = useStore((state) => state.resources);
  const modules = useStore((state) => state.modules);
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const gameTime = useStore((state) => state.gameTime);
  const [, forceUpdate] = useState(0);
  const [transferPage, setTransferPage] = useState(0);

  // Refresh every 500ms to update ETAs
  useEffect(() => {
    const id = window.setInterval(() => {
      forceUpdate((v) => v + 1);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const transfers = logisticsQueues.pendingTransfers;
  const totalHaulers = factories.reduce((sum: number, f) => sum + (f.haulersAssigned ?? 0), 0);
  const activeTransfers = transfers.filter(
    (t) => t.status === 'scheduled' || t.status === 'in-transit',
  );
  const completedTransfers = transfers.filter((t) => t.status === 'completed').length;
  const moduleBonuses = getHaulerModuleBonuses(modules);

  const totalTransferPages = Math.max(1, Math.ceil(activeTransfers.length / TRANSFERS_PAGE_SIZE));
  const safeTransferPage = Math.min(transferPage, totalTransferPages - 1);
  const transferStart = safeTransferPage * TRANSFERS_PAGE_SIZE;
  const visibleTransfers = activeTransfers.slice(
    transferStart,
    transferStart + TRANSFERS_PAGE_SIZE,
  );

  return (
    <div className="logistics-panel">
      <h4>Logistics Network</h4>

      <div className="logistics-summary">
        <div className="summary-item">
          <span className="label">Haulers:</span>
          <span className="value">{totalHaulers}</span>
        </div>
        <div className="summary-item">
          <span className="label">Active Transfers:</span>
          <span className="value">{activeTransfers.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Completed:</span>
          <span className="value">{completedTransfers}</span>
        </div>
        <div className="summary-item">
          <span className="label">Warehouse Bars:</span>
          <span className="value">{Math.floor(resources.bars).toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="label">Network Bonus:</span>
          <span className="value">
            +{moduleBonuses.capacityBonus} cap · ×{moduleBonuses.speedMultiplier.toFixed(2)} speed
          </span>
        </div>
      </div>

      <div className="transfers-list">
        <div className="transfers-header">
          <h5>Active Transfers</h5>
          <PaginationControls
            currentPage={safeTransferPage}
            totalPages={totalTransferPages}
            onNextPage={() => setTransferPage((p) => Math.min(totalTransferPages - 1, p + 1))}
            onPrevPage={() => setTransferPage((p) => Math.max(0, p - 1))}
            className="transfers-pagination"
            ariaLabelPrefix="page"
          />
        </div>
        {activeTransfers.length === 0 ? (
          <p className="muted">No transfers in progress</p>
        ) : (
          <>
            {visibleTransfers.map((transfer) => {
              const remainingTime = Math.max(0, transfer.eta - (gameTime ?? 0));
              const sourceFactory = factories.find((f) => f.id === transfer.fromFactoryId);
              const destFactory = factories.find((f) => f.id === transfer.toFactoryId);
              const sourceName =
                transfer.fromFactoryId === WAREHOUSE_NODE_ID
                  ? 'Warehouse'
                  : (sourceFactory?.id ?? transfer.fromFactoryId);
              const destName =
                transfer.toFactoryId === WAREHOUSE_NODE_ID
                  ? 'Warehouse'
                  : (destFactory?.id ?? transfer.toFactoryId);
              const sourceLabel =
                transfer.fromFactoryId === WAREHOUSE_NODE_ID
                  ? 'WH'
                  : (sourceFactory?.id.slice(0, 4) ?? '???');
              const destLabel =
                transfer.toFactoryId === WAREHOUSE_NODE_ID
                  ? 'WH'
                  : (destFactory?.id.slice(0, 4) ?? '???');
              return (
                <div key={transfer.id} className="transfer-item">
                  <div className="transfer-route">
                    <span className="factory-short" title={sourceName}>
                      {sourceLabel}
                    </span>
                    <span className="arrow">→</span>
                    <span className="factory-short" title={destName}>
                      {destLabel}
                    </span>
                  </div>
                  <div className="transfer-details">
                    <span className="resource">
                      {Math.round(transfer.amount)} {transfer.resource}
                    </span>
                    <span className="eta">ETA: {remainingTime.toFixed(1)}s</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {totalHaulers === 0 && (
        <div className="logistics-hint">
          <p>Assign haulers to factories to enable resource redistribution.</p>
        </div>
      )}
    </div>
  );
};
