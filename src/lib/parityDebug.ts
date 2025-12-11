export const parityDebugEnabled: boolean = (() => {
  try {
    const globalAny = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    if (globalAny.process?.env?.PARITY_DEBUG === '1') {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
})();

const getCurrentStep = () => {
  try {
    const globalAny = globalThis as unknown as { __PARITY_TS_STEP?: number };
    return globalAny.__PARITY_TS_STEP ?? null;
  } catch {
    return null;
  }
};

export const parityDebugLog = (label: string, payload: Record<string, unknown>) => {
  if (!parityDebugEnabled) return;
  const step = getCurrentStep();
  const enriched = step == null ? payload : { step, ...payload };
  console.warn(label, enriched);
};
