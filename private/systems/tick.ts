import { gt, lte, mulUS, multiplyInto, subUS, writeNumber } from "../core/break_eternity.js";
import { consumeTierOneRewardsChanged } from "../game/achievements.js";
import { updateCourage } from "../game/courage.js";
import { addCondenseTime, addGameTime, addPlayerTime, gainProductionCurrency, updateHighestManaReached } from "../game/currencies.js";
import { getGameSpeed, isQuestActive, updatePotionEffects, updateQuestBoard } from "../guild/guild.js";
import { HANDLES } from "../core/player.js";
import { refreshMatrixDerivedState, refreshSealedMeridiansDerivedState, resetCastSpeed } from "../game/progression.js";
import { SCRATCH_HANDLES } from "../core/scratch.js";
import { applyCrystal11ManaAbsorberReward, refreshTierOneDerivedState, synchronizeCrystal11Multipliers } from "../game/tier_one.js";
import { isAllProducersManaAbsorbersCrystalActive, isCrystalActive } from "../game/crystals.js";
import { PerformanceStats } from "./performance-stats.js";
import { tickKeybinds } from "./keybinds.js";
import { updateAutocasters } from "../guild/autocasters.js";
import { tickAbyssRunTime } from "../abyss/abyss.js";

/** [WASM] */

const MAX_PRODUCTION_ENTITIES: i32 = 128;
const MAX_GROUPS: i32 = 32;
const MAX_MODIFIERS: i32 = 4096;

export const MODIFIER_SCOPE_GLOBAL: i32 = 0;
export const MODIFIER_SCOPE_GROUP: i32 = 1;
export const MODIFIER_SCOPE_ENTITY: i32 = 2;
export const MODIFIER_TYPE_PRODUCTION: i32 = 0;
export const MODIFIER_TYPE_COST: i32 = 1;
export const MODIFIER_TYPE_SPEED: i32 = 2;
export const GENERATOR_GROUP: i32 = 0;

const entityAmountHandle = new StaticArray<i32>(MAX_PRODUCTION_ENTITIES);
const entityDestinationHandle = new StaticArray<i32>(MAX_PRODUCTION_ENTITIES);
const entityBaseProductionHandle = new StaticArray<i32>(MAX_PRODUCTION_ENTITIES);
const entityBaseMultiplierHandle = new StaticArray<i32>(MAX_PRODUCTION_ENTITIES);
const entityGroup = new StaticArray<i32>(MAX_PRODUCTION_ENTITIES);

let productionEntityCount: i32 = 0;
let secondsHandle: i32 = 0;
let productionHandle: i32 = 0;
let modifierHandle: i32 = 0;
let updatesPerSecondHandle: i32 = 0;
let castSpeedTimerHandle: i32 = 0;
let castSpeedMagnitudeHandle: i32 = 0;
let castSpeedCostHandle: i32 = 0;
let manaCurrencyHandle: i32 = 0;
let manaAbsorberCurrencyHandle: i32 = 0;

const modifierScope = new StaticArray<i32>(MAX_MODIFIERS);
const modifierTarget = new StaticArray<i32>(MAX_MODIFIERS);
const modifierType = new StaticArray<i32>(MAX_MODIFIERS);
const modifierValue = new StaticArray<f64>(MAX_MODIFIERS);
const modifierActive = new StaticArray<u8>(MAX_MODIFIERS);
let modifierCount: i32 = 0;

let globalProductionMultiplier: f64 = 1;
let globalCostMultiplier: f64 = 1;
let globalSpeedMultiplier: f64 = 1;
const groupProductionMultiplier = new StaticArray<f64>(MAX_GROUPS);
const groupCostMultiplier = new StaticArray<f64>(MAX_GROUPS);
const groupSpeedMultiplier = new StaticArray<f64>(MAX_GROUPS);
const entityProductionMultiplier = new StaticArray<f64>(MAX_PRODUCTION_ENTITIES);
const entityCostMultiplier = new StaticArray<f64>(MAX_PRODUCTION_ENTITIES);
const entitySpeedMultiplier = new StaticArray<f64>(MAX_PRODUCTION_ENTITIES);

export function initializeTick(
    tickSecondsHandle: i32,
    tickProductionHandle: i32,
    tickModifierHandle: i32,
    tickUpdatesPerSecondHandle: i32,
    speedTimerHandle: i32,
    speedMagnitudeHandle: i32,
    speedCostHandle: i32,
    manaCurrency: i32,
): void {
    secondsHandle = tickSecondsHandle;
    productionHandle = tickProductionHandle;
    modifierHandle = tickModifierHandle;
    updatesPerSecondHandle = tickUpdatesPerSecondHandle;
    castSpeedTimerHandle = speedTimerHandle;
    castSpeedMagnitudeHandle = speedMagnitudeHandle;
    castSpeedCostHandle = speedCostHandle;
    manaCurrencyHandle = manaCurrency;
    initializeModifierCaches();
}

export function registerProductionEntity(
    amountHandle: i32,
    destinationHandle: i32,
    baseProductionHandle: i32,
    baseMultiplierHandle: i32,
    group: i32,
): i32 {
    if (productionEntityCount >= MAX_PRODUCTION_ENTITIES) {
        throw new Error("Exceeded MAX_PRODUCTION_ENTITIES");
    }
    const entity = productionEntityCount++;
    entityAmountHandle[entity] = amountHandle;
    entityDestinationHandle[entity] = destinationHandle;
    entityBaseProductionHandle[entity] = baseProductionHandle;
    entityBaseMultiplierHandle[entity] = baseMultiplierHandle;
    entityGroup[entity] = group;
    if (entity === 3) manaAbsorberCurrencyHandle = destinationHandle;
    return entity;
}

export function addModifier(scope: i32, target: i32, type: i32, value: f64): i32 {
    if (modifierCount >= MAX_MODIFIERS) throw new Error("Exceeded MAX_MODIFIERS");
    const modifier = modifierCount++;
    modifierScope[modifier] = scope;
    modifierTarget[modifier] = target;
    modifierType[modifier] = type;
    modifierValue[modifier] = value;
    modifierActive[modifier] = 1;
    refreshModifierCache(scope, target, type);
    return modifier;
}

export function removeModifier(modifier: i32): void {
    if (modifier < 0 || modifier >= modifierCount) throw new Error("Invalid modifier ID");
    if (modifierActive[modifier] === 0) return;
    modifierActive[modifier] = 0;
    refreshModifierCache(modifierScope[modifier], modifierTarget[modifier], modifierType[modifier]);
}

export function setModifierActive(modifier: i32, active: bool): void {
    if (modifier < 0 || modifier >= modifierCount) throw new Error("Invalid modifier ID");
    const value: u8 = active ? 1 : 0;
    if (modifierActive[modifier] === value) return;
    modifierActive[modifier] = value;
    refreshModifierCache(modifierScope[modifier], modifierTarget[modifier], modifierType[modifier]);
}

export function productionMultiplierFor(entity: i32): f64 {
    return globalProductionMultiplier
        * groupProductionMultiplier[entityGroup[entity]]
        * entityProductionMultiplier[entity];
}

export function costMultiplierFor(entity: i32): f64 {
    return globalCostMultiplier * groupCostMultiplier[entityGroup[entity]] * entityCostMultiplier[entity];
}

export function speedMultiplierFor(entity: i32): f64 {
    return globalSpeedMultiplier * groupSpeedMultiplier[entityGroup[entity]] * entitySpeedMultiplier[entity];
}

function tickProduction(deltaMilliseconds: f64, countTimePlayed: bool): void {
    writeNumber(secondsHandle, deltaMilliseconds / 1000);
    writeNumber(updatesPerSecondHandle, 1000 / deltaMilliseconds);
    if (countTimePlayed) addPlayerTime(secondsHandle);
    else addCondenseTime(secondsHandle);
    updateCourage(secondsHandle);
    multiplyInto(modifierHandle, secondsHandle, getGameSpeed());
    addGameTime(modifierHandle);
    applyCastSpeed();
    mulUS(secondsHandle, getGameSpeed());
    for (let entity: i32 = 0; entity < productionEntityCount; entity++) {
        if (isQuestActive() && entityDestinationHandle[entity] === manaCurrencyHandle) continue;
        multiplyInto(productionHandle, entityAmountHandle[entity], secondsHandle);
        mulUS(mulUS(productionHandle, entityBaseProductionHandle[entity]), entityBaseMultiplierHandle[entity]);
        writeNumber(modifierHandle, productionMultiplierFor(entity) * speedMultiplierFor(entity));
        mulUS(productionHandle, modifierHandle);
        const destination = isAllProducersManaAbsorbersCrystalActive() && entity < productionEntityCount - 1
            ? manaAbsorberCurrencyHandle
            : entityDestinationHandle[entity];
        if (entity === productionEntityCount - 1) applyCrystal11ManaAbsorberReward(productionHandle);
        gainProductionCurrency(destination, productionHandle);
    }
}

function applyCastSpeed(): void {
    if (!gt(castSpeedTimerHandle, 0)) {
        resetCastSpeed();
        return;
    }
    if (lte(castSpeedTimerHandle, secondsHandle)) {
        resetCastSpeed();
    } else {
        subUS(castSpeedTimerHandle, secondsHandle);
    }
    mulUS(secondsHandle, castSpeedMagnitudeHandle);
}

function initializeModifierCaches(): void {
    for (let group: i32 = 0; group < MAX_GROUPS; group++) {
        groupProductionMultiplier[group] = 1;
        groupCostMultiplier[group] = 1;
        groupSpeedMultiplier[group] = 1;
    }
    for (let entity: i32 = 0; entity < MAX_PRODUCTION_ENTITIES; entity++) {
        entityProductionMultiplier[entity] = 1;
        entityCostMultiplier[entity] = 1;
        entitySpeedMultiplier[entity] = 1;
    }
}

function refreshModifierCache(scope: i32, target: i32, type: i32): void {
    const value = calculateModifier(scope, target, type);

    switch (scope) {
        case MODIFIER_SCOPE_GLOBAL:
            switch (type) {
                case MODIFIER_TYPE_PRODUCTION:
                    globalProductionMultiplier = value;
                    break;
                case MODIFIER_TYPE_COST:
                    globalCostMultiplier = value;
                    break;
                case MODIFIER_TYPE_SPEED:
                    globalSpeedMultiplier = value;
                    break;
            }
            break;

        case MODIFIER_SCOPE_GROUP:
            switch (type) {
                case MODIFIER_TYPE_PRODUCTION:
                    groupProductionMultiplier[target] = value;
                    break;
                case MODIFIER_TYPE_COST:
                    groupCostMultiplier[target] = value;
                    break;
                case MODIFIER_TYPE_SPEED:
                    groupSpeedMultiplier[target] = value;
                    break;
            }
            break;

        default:
            switch (type) {
                case MODIFIER_TYPE_PRODUCTION:
                    entityProductionMultiplier[target] = value;
                    break;
                case MODIFIER_TYPE_COST:
                    entityCostMultiplier[target] = value;
                    break;
                case MODIFIER_TYPE_SPEED:
                    entitySpeedMultiplier[target] = value;
                    break;
            }
            break;
    }
}

function calculateModifier(scope: i32, target: i32, type: i32): f64 {
    let result: f64 = 1;
    for (let modifier: i32 = 0; modifier < modifierCount; modifier++) {
        if (modifierActive[modifier] === 0) continue;
        if (modifierScope[modifier] !== scope) continue;
        if (modifierTarget[modifier] !== target) continue;
        if (modifierType[modifier] !== type) continue;
        result *= modifierValue[modifier];
    }
    return result;
}

export function tick(deltaMilliseconds: f64, countTimePlayed: bool, chargeAutocasterWages: bool): void {
    tickAbyssRunTime(deltaMilliseconds / 1000);
    if (!(deltaMilliseconds > 0) || !isFinite(deltaMilliseconds)) return;
    if (isAllProducersManaAbsorbersCrystalActive()) synchronizeCrystal11Multipliers();
    writeNumber(secondsHandle, deltaMilliseconds / 1000);
    updatePotionEffects(secondsHandle);
    updateQuestBoard(deltaMilliseconds / 1000);
    updateAutocasters(deltaMilliseconds / 1000, chargeAutocasterWages);
    tickProduction(deltaMilliseconds, countTimePlayed);
    if (!isCrystalActive()) updateHighestManaReached();
    if (consumeTierOneRewardsChanged()) {
        refreshSealedMeridiansDerivedState();
        refreshMatrixDerivedState();
        refreshSealedMeridiansDerivedState();
        refreshTierOneDerivedState();
    }
}

export function simulateTicks(durationMilliseconds: f64, stepMilliseconds: f64, countTimePlayed: bool): void {
    if (durationMilliseconds <= 0 || stepMilliseconds <= 0) return;
    let remainingMilliseconds = durationMilliseconds;
    while (remainingMilliseconds > 0) {
        const tickMilliseconds = Math.min(stepMilliseconds, remainingMilliseconds);
        tick(tickMilliseconds, countTimePlayed, false);
        remainingMilliseconds -= tickMilliseconds;
    }
}

/** [/WASM] */

initializeTick(
    SCRATCH_HANDLES.tierOneSeconds,
    SCRATCH_HANDLES.tierOneProduction,
    SCRATCH_HANDLES.productionModifier,
    SCRATCH_HANDLES.updatesPerSecond,
    HANDLES.castSpeedTimer,
    HANDLES.castSpeedMagnitude,
    HANDLES.castSpeedCost,
    HANDLES.mana,
);

registerProductionEntity(
    HANDLES.count_manufactureStaff,
    HANDLES.count_creationManufactory,
    1,
    HANDLES.multiplier_manufactureStaff,
    0,
);
registerProductionEntity(
    HANDLES.count_creationManufactory,
    HANDLES.count_conjugationCreation,
    1,
    HANDLES.multiplier_creationManufactory,
    0,
);
registerProductionEntity(
    HANDLES.count_conjugationCreation,
    HANDLES.count_conduitConjugation,
    1,
    HANDLES.multiplier_conjugationCreation,
    0,
);
registerProductionEntity(
    HANDLES.count_conduitConjugation,
    HANDLES.count_manaConduit,
    1,
    HANDLES.multiplier_conduitConjugation,
    0,
);
registerProductionEntity(
    HANDLES.count_manaConduit,
    HANDLES.mana,
    3,
    HANDLES.multiplier_manaConduit,
    0,
);


const UPDATE_RATE_STORAGE_KEY = "updateRate";
const OFFLINE_PROGRESS_STORAGE_KEY = "offlineProgress";
const MIN_UPDATE_RATE = 10;
const MAX_UPDATE_RATE = 200;
const DEFAULT_UPDATE_RATE = 100;
let updateRate = loadUpdateRate();
setUpdateRate(updateRate);
let offlineProgress = loadOfflineProgress();

const BASE_SIMULATION_BATCH_SIZE = 500;
const simulationListeners = new Set<(state: TimeSimulationState) => void>();
let simulationActive = false;
let simulationStepMilliseconds = DEFAULT_UPDATE_RATE;
let simulationSkipRequested = false;
let simulationTotalMilliseconds = 0;
let simulationCompletedMilliseconds = 0;

export interface TimeSimulationState {
    readonly active: boolean;
    readonly totalSeconds: number;
    readonly simulatedSeconds: number;
    readonly progress: number;
    readonly speed: number;
}

export function getUpdateRate(): number {
    return updateRate;
}

export function setUpdateRate(value: number): number {
    updateRate = Math.max(MIN_UPDATE_RATE, Math.min(MAX_UPDATE_RATE, Math.round(value)));
    try {
        localStorage.setItem(UPDATE_RATE_STORAGE_KEY, String(updateRate));
    } catch (error) {
        console.error("Failed to save update rate", error);
    }
    return updateRate;
}

export function isOfflineProgressEnabled(): boolean {
    return offlineProgress;
}

export function setOfflineProgressEnabled(enabled: boolean): void {
    offlineProgress = enabled;
    try {
        localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, String(enabled));
    } catch (error) {
        console.error("Failed to save offline progress setting", error);
    }
}

export function subscribeToTimeSimulation(listener: (state: TimeSimulationState) => void): () => void {
    simulationListeners.add(listener);
    listener(currentSimulationState());
    return () => simulationListeners.delete(listener);
}

export async function simulateTime(seconds: number, countTimePlayed = true): Promise<void> {
    if (!offlineProgress || simulationActive) return;
    const finiteSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (finiteSeconds === 0) return;

    simulationActive = true;
    simulationStepMilliseconds = updateRate;
    simulationSkipRequested = false;
    simulationTotalMilliseconds = finiteSeconds * 1000;
    simulationCompletedMilliseconds = 0;
    notifySimulationListeners();

    try {
        while (simulationCompletedMilliseconds < simulationTotalMilliseconds) {
            const remainingMilliseconds = simulationTotalMilliseconds - simulationCompletedMilliseconds;
            if (simulationSkipRequested) {
                simulateTicks(
                    remainingMilliseconds,
                    Math.max(simulationStepMilliseconds, remainingMilliseconds / 100),
                    countTimePlayed,
                );
                simulationCompletedMilliseconds = simulationTotalMilliseconds;
                notifySimulationListeners();
                break;
            }

            const batchMilliseconds = Math.min(
                remainingMilliseconds,
                BASE_SIMULATION_BATCH_SIZE * simulationStepMilliseconds,
            );
            simulateTicks(batchMilliseconds, simulationStepMilliseconds, countTimePlayed);
            simulationCompletedMilliseconds += batchMilliseconds;
            notifySimulationListeners();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    } finally {
        simulationActive = false;
        notifySimulationListeners();
    }
}

export function speedUpTimeSimulation(): void {
    if (!simulationActive) return;
    simulationStepMilliseconds *= 2;
    notifySimulationListeners();
}

export function skipTimeSimulation(): void {
    if (simulationActive) simulationSkipRequested = true;
}

function currentSimulationState(): TimeSimulationState {
    return {
        active: simulationActive,
        totalSeconds: simulationTotalMilliseconds / 1000,
        simulatedSeconds: simulationCompletedMilliseconds / 1000,
        progress: simulationTotalMilliseconds === 0
            ? 0
            : Math.min(1, simulationCompletedMilliseconds / simulationTotalMilliseconds),
        speed: simulationStepMilliseconds / updateRate,
    };
}

function notifySimulationListeners(): void {
    const state = currentSimulationState();
    for (const listener of simulationListeners) listener(state);
}

function loadUpdateRate(): number {
    try {
        const storedValue = localStorage.getItem(UPDATE_RATE_STORAGE_KEY);
        if (storedValue === null) return DEFAULT_UPDATE_RATE;
        const savedValue = Number(storedValue);
        if (Number.isFinite(savedValue)) {
            return Math.max(MIN_UPDATE_RATE, Math.min(MAX_UPDATE_RATE, Math.round(savedValue)));
        }
    } catch (error) {
        console.error("Failed to load update rate", error);
    }
    return DEFAULT_UPDATE_RATE;
}

function loadOfflineProgress(): boolean {
    try {
        return localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY) !== "false";
    } catch (error) {
        console.error("Failed to load offline progress setting", error);
        return true;
    }
}

let lastTickTimestamp = performance.now();

function runTick(): void {
    PerformanceStats.begin("tick");
    const start = performance.now();
    const elapsedMilliseconds = Math.max(0, start - lastTickTimestamp);
    lastTickTimestamp = start;
    if (!simulationActive) {
        if (elapsedMilliseconds > 10_000) {
            if (offlineProgress) void simulateTime(elapsedMilliseconds / 1000, true);
        } else {
            tick(elapsedMilliseconds, true, true);
        }
    }
    tickKeybinds();
    const deltaTime = performance.now() - start;
    setTimeout(runTick, Math.max(0, updateRate - deltaTime));
    PerformanceStats.end("tick");
}

runTick();
(globalThis as any).simulateTime = simulateTime;
