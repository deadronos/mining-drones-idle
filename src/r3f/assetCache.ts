import { CanvasTexture, RepeatWrapping } from 'three';

/**
 * Shared asset cache for reusing GPU resources across multiple instances.
 * Reduces memory usage and texture upload overhead by centralizing texture creation.
 */

interface CachedAsset {
  asset: CanvasTexture;
  refCount: number;
}

const cache = new Map<string, CachedAsset>();

/**
 * Create or retrieve a cached conveyor belt texture.
 * Multiple instances of the same texture share a single GPU resource.
 * @returns The cached CanvasTexture, or null if running in SSR context (no document)
 */
export const getConveyorTexture = (): CanvasTexture | null => {
  const key = 'conveyor-belt-texture';

  // Check if already cached
  const cached = cache.get(key);
  if (cached) {
    cached.refCount += 1;
    return cached.asset;
  }

  // Create texture only if in browser environment
  if (typeof document === 'undefined') return null;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#1f2937';
    for (let x = 0; x < size; x += 16) {
      context.fillRect(x, 0, 8, size);
    }
    context.fillStyle = '#38bdf8';
    context.globalAlpha = 0.2;
    for (let x = 0; x < size; x += 32) {
      context.fillRect(x, 0, 4, size);
    }
    context.globalAlpha = 1;
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 1);

  // Store in cache with initial ref count of 1
  cache.set(key, { asset: texture, refCount: 1 });

  return texture;
};

/**
 * Release a reference to a cached texture. Disposes the texture when ref count reaches zero.
 */
export const releaseConveyorTexture = (): void => {
  const key = 'conveyor-belt-texture';
  const cached = cache.get(key);

  if (!cached) return;

  cached.refCount -= 1;
  if (cached.refCount <= 0) {
    cached.asset.dispose();
    cache.delete(key);
  }
};

/**
 * Clear all cached assets (useful for cleanup during app shutdown).
 */
export const clearAssetCache = (): void => {
  cache.forEach(({ asset }) => {
    asset.dispose();
  });
  cache.clear();
};
