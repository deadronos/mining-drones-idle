import fs from 'fs';
import path from 'path';
import process from 'node:process';

const PARITY_FLAG =
  process.env.PARITY_DEBUG === '1' ||
  process.argv.some((arg) => arg.includes('debug-parity'));

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results', 'parity');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'parity-report';

const ensureDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
};

export const parityDebugEnabled = PARITY_FLAG;

export function writeParityReport(label: string, payload: unknown): string | null {
  if (!PARITY_FLAG) return null;
  ensureDir();
  const filename = `${slugify(label)}.json`;
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        label,
        timestamp: new Date().toISOString(),
        payload,
      },
      null,
      2
    )
  );
  return filePath;
}

export function logDivergences(
  label: string,
  divergences: string[],
  context?: Record<string, unknown>
): string | null {
  if (divergences.length === 0 && !PARITY_FLAG) {
    return null;
  }

  if (divergences.length > 0) {
    console.warn(`${label} divergences (${divergences.length})`, divergences);
  }

  if (!PARITY_FLAG) {
    return null;
  }

  return writeParityReport(label, {
    divergences,
    context,
  });
}

export function recordRollingMetrics(
  label: string,
  series: Array<{ t: number; value: number }>,
  context?: Record<string, unknown>
): string | null {
  if (!PARITY_FLAG) {
    return null;
  }
  return writeParityReport(label, { series, context });
}
