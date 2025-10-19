import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import './LogisticsPanel.css';

/**
 * Global Logistics Panel: overview of all factory transfers and hauler allocation
 */
export const LogisticsPanel = () => {
  const factories = useStore((state) => state.factories);
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const gameTime = useStore((state) => state.gameTime);
  const [, forceUpdate] = useState(0);

  // Refresh every 500ms to update ETAs
  useEffect(() => {
    const id = window.setInterval(() => {
      forceUpdate((v) => v + 1);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const transfers = logisticsQueues.pendingTransfers;
  const totalHaulers = factories.reduce((sum: number, f) => sum + ((f.haulersAssigned as number | undefined) ?? 0), 0);
  const activeTransfers = transfers.filter((t) => t.status === 'scheduled' || t.status === 'in-transit').length;
  const completedTransfers = transfers.filter((t) => t.status === 'completed').length;

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
          <span className="value">{activeTransfers}</span>
        </div>
        <div className="summary-item">
          <span className="label">Completed:</span>
          <span className="value">{completedTransfers}</span>
        </div>
      </div>

      {transfers.length === 0 ? (
        <p className="muted">No transfers in progress</p>
      ) : (
        <div className="transfers-list">
          <h5>Active Transfers</h5>
          {transfers
            .filter((t) => t.status === 'scheduled' || t.status === 'in-transit')
            .slice(0, 10)
            .map((transfer) => {
              const remainingTime = Math.max(0, transfer.eta - (gameTime ?? 0));
              const sourceFactory = factories.find((f) => f.id === transfer.fromFactoryId);
              const destFactory = factories.find((f) => f.id === transfer.toFactoryId);
              return (
                <div key={transfer.id} className="transfer-item">
                  <div className="transfer-route">
                    <span className="factory-short">{sourceFactory?.id.slice(0, 4)}</span>
                    <span className="arrow">→</span>
                    <span className="factory-short">{destFactory?.id.slice(0, 4)}</span>
                  </div>
                  <div className="transfer-details">
                    <span className="resource">
                      {Math.round(transfer.amount)} {transfer.resource}
                    </span>
                    <span className="eta">
                      ETA: {remainingTime.toFixed(1)}s
                    </span>
                  </div>
                </div>
              );
            })}
          {transfers.filter((t) => t.status === 'scheduled' || t.status === 'in-transit').length > 10 && (
            <p className="muted small">
              +{transfers.filter((t) => t.status === 'scheduled' || t.status === 'in-transit').length - 10} more
            </p>
          )}
        </div>
      )}

      {totalHaulers === 0 && (
        <div className="logistics-hint">
          <p>Assign haulers to factories to enable resource redistribution.</p>
        </div>
      )}
    </div>
  );
};
