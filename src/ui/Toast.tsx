import { useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'error';

interface ToastProps {
  message: string;
  onClose?: () => void;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
  type?: ToastType;
  priority?: 'low' | 'normal' | 'high';
}

export const Toast = ({
  message,
  onClose,
  durationMs = 4000,
  actionLabel,
  onAction,
  type = 'info',
  priority = 'normal',
}: ToastProps) => {
  useEffect(() => {
    // high priority toasts persist longer by default
    const effective = priority === 'high' ? Math.max(durationMs, 8000) : durationMs;
    const t = setTimeout(() => onClose?.(), effective);
    return () => clearTimeout(t);
  }, [onClose, durationMs, priority]);

  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`toast toast--${type} toast--${priority}`}
    >
      <div className="toast-message">{message}</div>
      <div className="toast-actions">
        {actionLabel && onAction ? (
          <button type="button" className="toast-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        <button type="button" className="toast-dismiss" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
