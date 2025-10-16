/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from './Toast';

type ToastEntry = { id: string; message: string };

interface ToastContextValue {
  push: (message: string) => string;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // provide a safe no-op implementation when ToastProvider is not present (tests or minimal host)
    return {
      push: (message: string) => {
         
        console.info('Toast:', message);
        return 'noop';
      },
      remove: (_id: string) => undefined,
    } as ToastContextValue;
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const push = useCallback((message: string) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, message }]);
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
