# Refactor store.ts

The `store.ts` file has become too large and contains a lot of different logic. This makes it hard to maintain and understand. The goal of this refactoring is to split the file into smaller, more focused files.

## Plan

1.  **`src/state/types.ts`**: This file will contain all the type definitions and interfaces. This includes:
    - `PerformanceProfile`
    - `VectorTuple`
    - `TravelSnapshot`
    - `RefineProcessSnapshot`
    - `FactoryResourceSnapshot`
    - `FactoryUpgradeSnapshot`
    - `FactorySnapshot`
    - `HaulerConfig`
    - `FactoryLogisticsState`
    - `PendingTransfer`
    - `LogisticsQueues`
    - `DroneFlightPhase`
    - `DroneFlightState`
    - `Resources`
    - `Modules`
    - `Prestige`
    - `SaveMeta`
    - `NotationMode`
    - `StoreSettings`
    - `RefineryStats`
    - `StoreSnapshot`
    - `StoreState`
    - `StoreApiType`
    - `ModuleId`
    - `FactoryUpgradeId`
    - `FactoryUpgradeDefinition`

2.  **`src/state/constants.ts`**: This file will contain all the constants. This includes:
    - `SAVE_VERSION`
    - `GROWTH`
    - `PRESTIGE_THRESHOLD`
    - `BASE_REFINERY_RATE`
    - `ORE_PER_BAR`
    - `ORE_CONVERSION_PER_SECOND`
    - `BASE_STORAGE`
    - `STORAGE_PER_LEVEL`
    - `BASE_ENERGY_CAP`
    - `ENERGY_PER_SOLAR`
    - `SOLAR_BASE_GEN`
    - `DRONE_ENERGY_COST`
    - `FACTORY_MIN_DISTANCE`
    - `FACTORY_MAX_DISTANCE`
    - `FACTORY_PLACEMENT_ATTEMPTS`
    - `FACTORY_UPGRADE_GROWTH`
    - `initialSettings`
    - `initialResources`
    - `initialModules`
    - `initialPrestige`
    - `initialSave`
    - `rawResourceKeys`
    - `emptyRefineryStats`
    - `moduleDefinitions`
    - `factoryUpgradeDefinitions`

3.  **`src/state/utils.ts`**: This file will contain all the utility functions. This includes:
    - `vector3ToTuple`
    - `tupleToVector3`
    - `generateSeed`
    - `computeFactoryPlacement`
    - `deriveProcessSequence`
    - `computeFactoryUpgradeCost`
    - `getFactoryUpgradeCost`
    - `computeRefineryProduction`
    - `applyRefineryProduction`
    - `costForLevel`
    - `computePrestigeGain`
    - `computePrestigeBonus`
    - `getStorageCapacity`
    - `getEnergyCapacity`
    - `getEnergyGeneration`
    - `getEnergyConsumption`
    - `computeEnergyThrottle`
    - `coerceNumber`

4.  **`src/state/serialization.ts`**: This file will contain the serialization and deserialization logic. This includes:
    - `normalizeVectorTuple`
    - `cloneVectorTuple`
    - `normalizeTravelSnapshot`
    - `cloneTravelSnapshot`
    - `normalizeDroneFlight`
    - `normalizeDroneFlights`
    - `cloneRefineProcess`
    - `snapshotToRefineProcess`
    - `normalizeFactoryResources`
    - `normalizeFactoryUpgrades`
    - `normalizeDroneOwners`
    - `normalizeRefineSnapshot`
    - `refineProcessToSnapshot`
    - `normalizeFactorySnapshot`
    - `cloneFactory`
    - `snapshotToFactory`
    - `factoryToSnapshot`
    - `cloneDroneFlight`
    - `mergeResourceDelta`
    - `normalizeResources`
    - `normalizeModules`
    - `normalizePrestige`
    - `normalizeSave`
    - `normalizeNotation`
    - `normalizePerformanceProfile`
    - `normalizeSettings`
    - `normalizeSnapshot`
    - `serializeStore`
    - `stringifySnapshot`
    - `parseSnapshot`

5.  **`src/state/migrations.ts`**: This file will contain the migration logic. This includes:
    - `applyMigrations`

6.  **`src/state/factory.ts`**: This file will contain all the factory related logic. This includes:
    - `createDefaultFactories`
    - `processFactories` (from the store)

7.  **`src/state/logistics.ts`**: This file will contain all the logistics related logic. This includes:
    - `processLogistics` (from the store)

8.  **`src/state/store.ts`**: This will be the main store file, containing the Zustand store creation and the core state and actions. It will import all the other files and use them to create the store.
