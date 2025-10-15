/**
 * Sanitize metadata passed to the React DevTools global hook to avoid
 * runtime semver validation errors. Some renderers (or bundles) may
 * register with the DevTools hook and provide empty version strings
 * which `semver` rejects. The DevTools backend may call semver on
 * these strings and throw, crashing the page or surfacing an
 * uncaught error.
 *
 * This module attempts to wrap the hook's `inject` implementation and
 * ensure common version fields are non-empty. It also installs a
 * temporary setter so it can wrap the hook if the extension defines
 * it after this script runs.
 *
 * IMPORTANT: import this module before React/ReactDOM so it runs
 * before any renderer has a chance to call the hook.
 */

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function sanitizeInjected(injected: Record<string, unknown>) {
  try {
    const setStringIfEmpty = (key: string, fallback: string) => {
      const val = injected[key];
      if (typeof val === 'string' && val.trim() === '') injected[key] = fallback;
    };

    setStringIfEmpty('version', '0.0.0');
    setStringIfEmpty('reconcilerVersion', '0.0.0');
    setStringIfEmpty('rendererPackageName', 'unknown-renderer');

    if (!('bundleType' in injected)) injected.bundleType = 0;
  } catch (err) {
    console.warn('devtools-sanitizer: failed to sanitize renderer metadata', err);
  }
}

function wrapHook(hook: Record<string, unknown>) {
  const maybeInject = hook.inject;
  if (typeof maybeInject !== 'function') return;

  const originalInject = maybeInject as (...args: unknown[]) => unknown;
  Object.defineProperty(hook, 'inject', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: function patchedInject(...args: unknown[]) {
      try {
        const firstArg = args[0];
        if (isRecord(firstArg)) sanitizeInjected(firstArg);
      } catch {
        // never throw from the sanitizer
      }
      return originalInject.apply(this, args);
    },
  });
}

(function install() {
  const hookName = '__REACT_DEVTOOLS_GLOBAL_HOOK__';
  const win = window as unknown as Record<string, unknown>;

  // If the hook already exists, wrap it immediately.
  const maybeHook = win[hookName];
  if (isRecord(maybeHook)) {
    wrapHook(maybeHook);
    return;
  }

  // Otherwise, define a temporary setter so we can intercept when the
  // hook is created later (for example by the browser extension).
  try {
    Object.defineProperty(win, hookName, {
      configurable: true,
      enumerable: false,
      get() {
        return undefined;
      },
      set(h: unknown) {
        // When the hook is set, wrap its inject method then replace the
        // property with the real hook value so subsequent code sees the
        // normal object.
        try {
          if (isRecord(h)) wrapHook(h);
        } catch {
          // ignore
        }
        Object.defineProperty(win, hookName, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: h,
        });
      },
    });
  } catch {
    // If defining the property is not allowed for any reason, fail
    // silently – we can't do anything useful in that environment.
  }
})();
