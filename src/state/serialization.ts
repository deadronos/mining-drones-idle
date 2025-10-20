/**
 * Backwards compatibility: All serialization functions have been refactored into
 * domain-focused modules in src/state/serialization/. This file re-exports them
 * for backwards compatibility with existing imports.
 *
 * New code should import directly from ./serialization/ or ./serialization/index
 */

export * from './serialization/index';

// Re-export game logic for resource merging (extracted to lib/)
export { mergeResourceDelta } from '@/lib/resourceMerging';
