/**
 * Lightweight debug logging helpers.
 *
 * Enable by setting one of:
 * - localStorage key 'debug:logistics' to '1' or 'true'
 * - env var LOG_LOGISTICS=1 (useful in tests or Node)
 */

// Narrow, type-safe access to process.env (Node/tests) using runtime guards only
function getEnvVar(name: string): string | undefined {
  try {
    const g: unknown = typeof globalThis !== 'undefined' ? (globalThis as unknown) : undefined;
    if (!g || typeof g !== 'object' || !('process' in g)) return undefined;
    const procUnknown = (g as { process?: unknown }).process;
    if (!procUnknown || typeof procUnknown !== 'object' || !('env' in procUnknown)) return undefined;
    const envUnknown = (procUnknown as { env?: unknown }).env;
    if (!envUnknown || typeof envUnknown !== 'object') return undefined;
    const val = (envUnknown as Record<string, unknown>)[name];
    return typeof val === 'string' ? val : undefined;
  } catch {
    return undefined;
  }
}

const LOG_ENV: string | undefined = getEnvVar('LOG_LOGISTICS');

export const isLogisticsDebugEnabled = (): boolean => {
  try {
    if (LOG_ENV === '1' || LOG_ENV?.toLowerCase() === 'true') return true;
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem('debug:logistics') ?? window.localStorage.getItem('DEBUG_LOGISTICS');
    return v === '1' || (v?.toLowerCase?.() === 'true');
  } catch {
    return false;
  }
};

export const logLogistics = (msg: string, ...args: unknown[]) => {
  if (!isLogisticsDebugEnabled()) return;
  // Use console.debug to keep noise low in production
  // Include a compact timestamp for sequence debugging
  const t = new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '';
  console.debug(`[logistics ${t}] ${msg}`, ...args);
};
