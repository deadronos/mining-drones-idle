/**
 * Factory upgrade detection and cost management.
 */

import type { BuildableFactory, FactoryUpgradeRequest } from './models';
import { computeUpgradeCost } from './config';
import type { FactoryUpgrades } from './models';

/**
 * Detects if a factory needs resources for its next upgrade.
 * Returns a FactoryUpgradeRequest if a shortfall is detected, null otherwise.
 *
 * This function:
 * 1. Iterates through available upgrades in priority order
 * 2. Computes cost for next affordable level of each upgrade
 * 3. Checks if factory has insufficient local resources
 * 4. Returns request if shortfall detected
 *
 * @param factory - Factory to check for upgrade shortfalls
 * @param upgradeIds - Array of upgrade IDs to check (in priority order)
 * @returns FactoryUpgradeRequest if shortfall detected, null otherwise
 */
export const detectUpgradeShortfall = (
  factory: BuildableFactory,
  upgradeIds: string[],
): FactoryUpgradeRequest | null => {
  // Don't create duplicate requests for upgrades already pending
  for (const existing of factory.upgradeRequests) {
    if (existing.status !== 'expired') {
      // Request exists and not expired; skip detection for now
      // Multiple requests per factory are allowed for different resources,
      // but we only create one per upgrade ID to avoid duplicate detection
      return null;
    }
  }

  // Check each upgrade in order for shortfall
  for (const upgradeId of upgradeIds) {
    const currentLevel = factory.upgrades[upgradeId as keyof typeof factory.upgrades] ?? 0;
    const nextCost = computeUpgradeCost(upgradeId as keyof FactoryUpgrades, currentLevel);

    if (!nextCost || Object.keys(nextCost).length === 0) {
      continue; // Skip if no cost defined
    }

    // Check if factory has all required resources locally
    let hasShortfall = false;
    for (const [resource, needed] of Object.entries(nextCost)) {
      if (typeof needed === 'number' && needed > 0) {
        const available = factory.resources[resource as keyof typeof factory.resources] ?? 0;
        if (available < needed) {
          hasShortfall = true;
          break;
        }
      }
    }

    if (hasShortfall) {
      // Create upgrade request with exact cost breakdown
      const now = Date.now();
      return {
        upgrade: upgradeId,
        resourceNeeded: nextCost,
        fulfilledAmount: {},
        status: 'pending' as const,
        createdAt: now,
        expiresAt: now + 60000, // 60 second timeout
      };
    }
  }

  return null;
};
