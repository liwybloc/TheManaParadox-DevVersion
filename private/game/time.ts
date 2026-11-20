import { unlockTierOneAchievement } from "./achievements.js";
import { addUS, copyInto, createDecimal, createZero, divUS, getLayer, getMagnitude, isFiniteDecimal, gt, gte, log10Into, lt, mulUS, powInto, powUS, subUS, writeNumber } from "../core/break_eternity.js";

import type { Player } from "../core/player.js";

declare const player: Player;

type TimeUpgradeDefinition = {
    name: string;
    description: string;
    currency: "real" | "game";
    cost: [number, number, number];
    costScaling: { type: "polynomial"; growth: number } | { type: "squared" };
    effectPerLevel: number;
    operation?: "multiply" | "power" | "add";
    timeUnit: "hour" | "year" | "none";
    timeScaling?: "linear" | "exponential" | "logarithmic" | "proportional";
    levelScaling?: "linear" | "exponential";
    logBase?: number;
    logDivisor?: number;
    dampenLog?: boolean;
    maxLevel: number;
};

export const TIME_UPGRADES: readonly TimeUpgradeDefinition[] = [
    { name: "First Moment", description: "×4^(total Real Time hours) production per level", currency: "real", cost: [1, 0, 5], costScaling: { type: "polynomial", growth: 2 }, effectPerLevel: 4, timeUnit: "hour", timeScaling: "exponential", levelScaling: "linear", maxLevel: 1000 },
    { name: "Unbound Hour", description: "×2^(total Real Time hours) game speed per level", currency: "real", cost: [1, 0, 60], costScaling: { type: "polynomial", growth: 2 }, effectPerLevel: 2, timeUnit: "hour", timeScaling: "exponential", levelScaling: "linear", maxLevel: 1000 },
    { name: "Remembered Dawn", description: "×3^(total Real Time hours) Condensed Mana per level", currency: "real", cost: [1, 0, 600], costScaling: { type: "polynomial", growth: 2 }, effectPerLevel: 3, timeUnit: "hour", timeScaling: "exponential", levelScaling: "linear", maxLevel: 1000 },
    { name: "Lasting Echoes", description: "×1.1 to Memory gain multiplier per level", currency: "real", cost: [1, 0, 1200], costScaling: { type: "polynomial", growth: 2 }, effectPerLevel: 1.1, timeUnit: "none", levelScaling: "exponential", maxLevel: 1000 },
    { name: "Deep Eternity", description: "^1.05 supplied Sonic strength per level", currency: "real", cost: [1, 0, 3600], costScaling: { type: "polynomial", growth: 5 }, effectPerLevel: 1.05, operation: "power", timeUnit: "none", maxLevel: 1000 },
    { name: "Everlasting Vessel", description: "^1.01 time drained per level", currency: "real", cost: [1, 0, 7200], costScaling: { type: "squared" }, effectPerLevel: 1.01, operation: "power", timeUnit: "none", maxLevel: 1000 },
    
    { name: "Momentum", description: "×total Game Time production per level", currency: "game", cost: [1, 0, 1e10], costScaling: { type: "squared" }, effectPerLevel: 1.5, timeUnit: "none", timeScaling: "proportional", levelScaling: "linear", maxLevel: 1000 },
    { name: "Pendulum", description: "^1.01 game speed per level", currency: "game", cost: [1, 0, 1e15], costScaling: { type: "squared" }, effectPerLevel: 1.01, operation: "power", timeUnit: "none", maxLevel: 1000 },
    { name: "Repeated Dawn", description: "×1.01^log10(1 + log10(total Game Time) / 100) condensed mana per level", currency: "game", cost: [1, 0, 1e20], costScaling: { type: "squared" }, effectPerLevel: 1.01, timeUnit: "none", timeScaling: "logarithmic", logDivisor: 100, dampenLog: true, levelScaling: "linear", maxLevel: 1000 },
    { name: "Faint Echoes", description: "+1 to Memory gain multiplier per level", currency: "game", cost: [1, 0, 1e30], costScaling: { type: "squared" }, effectPerLevel: 1, operation: "add", timeUnit: "none", maxLevel: 1000 },
    { name: "Lingering Depths", description: "×1.05^log10(1 + log10(total Game Time) / 100) supplied Sonic strength per level", currency: "game", cost: [1, 0, 1e50], costScaling: { type: "squared" }, effectPerLevel: 1.05, timeUnit: "none", timeScaling: "logarithmic", logDivisor: 100, dampenLog: true, levelScaling: "linear", maxLevel: 1000 },
    { name: "Borrowed Seconds", description: "^1.01 time drained per level", currency: "game", cost: [1, 0, 1e100], costScaling: { type: "squared" }, effectPerLevel: 1.01, operation: "power", timeUnit: "none", maxLevel: 1000 },
];

export const TIME_HANDLES = {
    storedRealTime: createZero(),
    storedGameTime: createZero(),
    totalRealTime: createZero(),
    totalGameTime: createZero(),
    cost: createZero(),
    costExponent: createZero(),
    costGrowth: createZero(),
    effect: createZero(),
    effectExponent: createZero(),
    effectBase: createZero(),
    multiplier: createZero(),
    gain: createZero(),
    timePower: createZero(),
    timePowerLog: createZero(),
};

/** [WASM] */
let clockOffsetSeconds: f64 = 0;
let clockBrokenAt: f64 = 0;
let timeStopped = false;
let clockRecoveryStage: i32 = 0;
let clockRepairPieces: i32 = 0;
let timeDrainMode: i32 = 0;
let storedRealTime: i32 = 0;
let storedGameTime: i32 = 0;
let totalRealTime: i32 = 0;
let totalGameTime: i32 = 0;
let costHandle: i32 = 0;
let costExponent: i32 = 0;
let costGrowth: i32 = 0;
let effectHandle: i32 = 0;
let effectExponent: i32 = 0;
let effectBase: i32 = 0;
let multiplierHandle: i32 = 0;
let gainHandle: i32 = 0;
let timePower: i32 = 0;
let timePowerLog: i32 = 0;
let mountainUnlocked = false;

export function initializeTimeHandles(real: i32, game: i32, totalReal: i32, totalGame: i32, cost: i32, costPower: i32, growth: i32, effect: i32, effectPower: i32, effectValue: i32, multiplier: i32, gain: i32, power: i32, powerLog: i32): void {
    storedRealTime = real;
    storedGameTime = game;
    totalRealTime = totalReal;
    totalGameTime = totalGame;
    costHandle = cost;
    costExponent = costPower;
    costGrowth = growth;
    effectHandle = effect;
    effectExponent = effectPower;
    effectBase = effectValue;
    multiplierHandle = multiplier;
    gainHandle = gain;
    timePower = power;
    timePowerLog = powerLog;
}
let timeDrainStartedAt: f64 = 0;
let worldPausedMilliseconds: f64 = 0;
const timeUpgradeLevels = new StaticArray<i32>(12);
const timeUpgradeBaseCosts = new StaticArray<i32>(12);
const timeUpgradeCostGrowth = new StaticArray<f64>(12);
const timeUpgradeSquared = new StaticArray<u8>(12);
const timeUpgradeEffects = new StaticArray<f64>(12);
const timeUpgradeMaxLevels = new StaticArray<i32>(12);
const timeUpgradeRealCurrency = new StaticArray<u8>(12);
const timeUpgradePeriodSeconds = new StaticArray<f64>(12);
const timeUpgradeTimeScaling = new StaticArray<i32>(12);
const timeUpgradeOperations = new StaticArray<i32>(12);
const timeUpgradeLinearLevel = new StaticArray<u8>(12);
const timeUpgradeLogBase = new StaticArray<f64>(12);
const timeUpgradeLogDivisor = new StaticArray<f64>(12);
const timeUpgradeLogDamping = new StaticArray<u8>(12);

export function initializeTimeUpgrade(index: i32, cost: i32, growth: f64, squared: bool, effect: f64, maxLevel: i32, realCurrency: bool, periodSeconds: f64, timeScaling: i32, operation: i32, linearLevel: bool, logBase: f64, logDivisor: f64, dampenLog: bool): void {
    if (index < 0 || index >= 12) return;
    timeUpgradeBaseCosts[index] = cost;
    timeUpgradeCostGrowth[index] = growth;
    timeUpgradeSquared[index] = squared ? 1 : 0;
    timeUpgradeEffects[index] = effect;
    timeUpgradeMaxLevels[index] = maxLevel;
    timeUpgradeRealCurrency[index] = realCurrency ? 1 : 0;
    timeUpgradePeriodSeconds[index] = periodSeconds;
    timeUpgradeTimeScaling[index] = timeScaling;
    timeUpgradeOperations[index] = operation;
    timeUpgradeLinearLevel[index] = linearLevel ? 1 : 0;
    timeUpgradeLogBase[index] = logBase;
    timeUpgradeLogDivisor[index] = logDivisor;
    timeUpgradeLogDamping[index] = dampenLog ? 1 : 0;
}

export function getWorldPausedMilliseconds(): f64 { return worldPausedMilliseconds; }
export function setWorldPausedMilliseconds(value: f64): void { worldPausedMilliseconds = isFinite(value) && value > 0 ? value : 0; }

export function getClockOffsetSeconds(): f64 { return clockOffsetSeconds; }
export function setClockOffsetSeconds(value: f64): void {
    clockOffsetSeconds = isFinite(value) && value > 0 ? Math.min(value, 86_400) : 0;
    if (clockOffsetSeconds < 86_400) {
        clockRecoveryStage = 0;
        clockRepairPieces = 0;
        timeDrainMode = 0;
    }
    refreshTimeStopped();
}
export function getClockBrokenAt(): f64 { return clockBrokenAt; }
export function setClockBrokenAt(value: f64): void {
    clockBrokenAt = isFinite(value) && value > 0 ? value : 0;
}
export function isClockBroken(): bool { return clockOffsetSeconds >= 86_400 && clockRecoveryStage < 3; }
export function getClockRecoveryStage(): i32 { return clockRecoveryStage; }
export function setClockRecoveryStage(value: i32): void {
    clockRecoveryStage = value < 0 ? 0 : value > 3 ? 3 : value;
    refreshTimeStopped();
}
export function getClockRepairPieces(): i32 { return clockRepairPieces; }
export function setClockRepairPieces(value: i32): void { clockRepairPieces = value & 15; }
export function repairClockPiece(index: i32, timestamp: f64): bool {
    if (clockRecoveryStage !== 2 || index < 0 || index > 3 || !isClockBroken()) return false;
    clockRepairPieces |= 1 << index;
    if (clockRepairPieces === 15) {
        if (clockBrokenAt > 0 && isFinite(timestamp) && timestamp > clockBrokenAt) worldPausedMilliseconds += timestamp - clockBrokenAt;
        setClockRecoveryStage(3);
    }
    return true;
}
function refreshTimeStopped(): void {
    timeStopped = isClockBroken();
    checkClockAchievements();
}
export function checkClockAchievements(): void {
    if (mountainUnlocked) unlockTierOneAchievement(63);
    if (clockOffsetSeconds >= 86_400) unlockTierOneAchievement(60);
    if (clockRecoveryStage === 3) unlockTierOneAchievement(61);
    writeNumber(costExponent, 3600);
    if (gte(totalRealTime, costExponent)) unlockTierOneAchievement(62);
}
export function setTimeStopped(value: bool): void { timeStopped = value; }
export function isWorldTimeStopped(): bool { return timeStopped || timeDrainMode === 1; }
export function isGameTimeStopped(): bool { return isWorldTimeStopped() || timeDrainMode === 2; }
export function getTimeDrainMode(): i32 { return timeDrainMode; }
export function setTimeDrainMode(value: i32): void {
    timeDrainMode = clockRecoveryStage === 3 && value >= 0 && value <= 2 ? value : 0;
}
export function getTimeDrainStartedAt(): f64 { return timeDrainStartedAt; }
export function setTimeDrainStartedAt(value: f64): void { timeDrainStartedAt = isFinite(value) && value > 0 ? value : 0; }
export function storedRealTimeHandle(): i32 { return storedRealTime; }
export function storedGameTimeHandle(): i32 { return storedGameTime; }
export function totalRealTimeHandle(): i32 { return totalRealTime; }
export function totalGameTimeHandle(): i32 { return totalGameTime; }
export function setStoredRealTime(value: f64): void { writeNumber(storedRealTime, isFinite(value) && value > 0 ? value : 0); }
export function setStoredGameTime(value: f64): void { writeNumber(storedGameTime, isFinite(value) && value > 0 ? value : 0); }
export function initializeLifetimeTimeTotals(): void {
    if (lt(totalRealTime, storedRealTime)) copyInto(totalRealTime, storedRealTime);
    if (lt(totalGameTime, storedGameTime)) copyInto(totalGameTime, storedGameTime);
}
export function accumulateDrainedTime(seconds: f64, gameSpeed: i32): void {
    if (timeStopped || !isFinite(seconds) || seconds <= 0 || timeDrainMode === 0) return;
    if (timeDrainMode === 2 && (!isFiniteDecimal(gameSpeed) || !gt(gameSpeed, 0))) return;
    copyInto(gainHandle, timeUpgradeMultiplierHandle(5));
    if (timeDrainMode === 2) mulUS(gainHandle, gameSpeed);
    applyTimeUpgradePower(gainHandle, 5);
    writeNumber(effectExponent, seconds);
    mulUS(gainHandle, effectExponent);
    if (timeDrainMode === 1) {
        addUS(storedRealTime, gainHandle);
        addUS(totalRealTime, gainHandle);
    } else {
        addUS(storedGameTime, gainHandle);
        addUS(totalGameTime, gainHandle);
    }
    checkClockAchievements();
}
export function isMountainUnlocked(): bool { return mountainUnlocked; }
export function setMountainUnlocked(value: bool): void { mountainUnlocked = value; }
export function isMountainUpgradeVisible(): bool {
    if (mountainUnlocked) return true;
    if (clockRecoveryStage !== 3) return false;
    for (let index: i32 = 0; index < 12; index++) if (timeUpgradeLevels[index] < 1) return false;
    return true;
}
export function timePowerHandle(): i32 {
    if (!isFiniteDecimal(player.statistics_totalTimePlayed) || !isFiniteDecimal(player.statistics_gameTimePlayed)
        || !gt(player.statistics_totalTimePlayed, 0) || !gt(player.statistics_gameTimePlayed, 1)) {
        writeNumber(timePower, 0);
        return timePower;
    }
    copyInto(timePower, player.statistics_totalTimePlayed);
    divUS(timePower, 60);
    log10Into(timePowerLog, player.statistics_gameTimePlayed);
    mulUS(timePower, timePowerLog);
    return timePower;
}
export function canBuyMountainUpgrade(): bool {
    if (mountainUnlocked || !isMountainUpgradeVisible()) return false;
    timePowerHandle();
    writeNumber(timePowerLog, 6_000_000);
    return gte(timePower, timePowerLog);
}
export function buyMountainUpgrade(): bool {
    if (!canBuyMountainUpgrade()) return false;
    mountainUnlocked = true;
    unlockTierOneAchievement(63);
    return true;
}

export function timeUpgradeLevel(index: i32): i32 {
    return index >= 0 && index < 12 ? timeUpgradeLevels[index] : 0;
}
export function setTimeUpgradeLevel(index: i32, value: i32): void {
    if (index >= 0 && index < 12) timeUpgradeLevels[index] = value < 0 ? 0 : value > timeUpgradeMaxLevels[index] ? timeUpgradeMaxLevels[index] : value;
}
export function timeUpgradeCostHandle(index: i32): i32 {
    if (index < 0 || index >= 12) {
        writeNumber(costHandle, 0);
        return costHandle;
    }
    const level = <f64>timeUpgradeLevels[index];
    if (timeUpgradeSquared[index] !== 0) {
        writeNumber(costGrowth, 2);
        writeNumber(costExponent, level);
        powInto(costHandle, costGrowth, costExponent);
        copyInto(costExponent, costHandle);
        powInto(costHandle, timeUpgradeBaseCosts[index], costExponent);
    } else {
        writeNumber(costGrowth, level + 1);
        writeNumber(costExponent, timeUpgradeCostGrowth[index]);
        powInto(costHandle, costGrowth, costExponent);
        mulUS(costHandle, timeUpgradeBaseCosts[index]);
    }
    return costHandle;
}
export function canBuyTimeUpgrade(index: i32): bool {
    if (clockRecoveryStage !== 3 || index < 0 || index >= 12 || timeUpgradeLevels[index] >= timeUpgradeMaxLevels[index]) return false;
    const currency = timeUpgradeRealCurrency[index] !== 0 ? storedRealTime : storedGameTime;
    return !lt(currency, timeUpgradeCostHandle(index));
}
export function buyTimeUpgrade(index: i32): bool {
    if (!canBuyTimeUpgrade(index)) return false;
    const currency = timeUpgradeRealCurrency[index] !== 0 ? storedRealTime : storedGameTime;
    subUS(currency, timeUpgradeCostHandle(index));
    timeUpgradeLevels[index]++;
    return true;
}
export function timeUpgradeEffectHandle(index: i32): i32 {
    if (index < 0 || index >= 12) {
        writeNumber(effectHandle, 1);
        return effectHandle;
    }
    const level = timeUpgradeLevels[index];
    const additive = timeUpgradeOperations[index] === 2;
    if (level === 0) {
        writeNumber(effectHandle, additive ? 0 : 1);
        return effectHandle;
    }
    const time = timeUpgradeRealCurrency[index] !== 0 ? player.statistics_totalTimePlayed : player.statistics_gameTimePlayed;
    const scaling = timeUpgradeTimeScaling[index];
    if (!isFiniteDecimal(time) && (scaling !== 0 || timeUpgradePeriodSeconds[index] > 0)) {
        writeNumber(effectHandle, additive ? 0 : 1);
        return effectHandle;
    }
    if (scaling === 3) {
        copyInto(effectHandle, time);
        writeNumber(effectBase, timeUpgradeEffects[index] * <f64>level);
        mulUS(effectHandle, effectBase);
        return effectHandle;
    }
    if (scaling === 2 || (scaling === 1 && timeUpgradePeriodSeconds[index] > 0)) {
        copyInto(effectExponent, time);
        if (scaling === 2) {
            if (gt(effectExponent, 1)) {
                log10Into(effectExponent, effectExponent);
                if (timeUpgradeLogBase[index] !== 10) {
                    writeNumber(effectBase, timeUpgradeLogBase[index]);
                    log10Into(effectBase, effectBase);
                    divUS(effectExponent, effectBase);
                }
            } else writeNumber(effectExponent, 0);
            writeNumber(effectBase, timeUpgradeLogDivisor[index]);
            divUS(effectExponent, effectBase);
            if (timeUpgradeLogDamping[index] !== 0) {
                addUS(effectExponent, 1);
                log10Into(effectExponent, effectExponent);
            }
        } else {
            writeNumber(effectBase, timeUpgradePeriodSeconds[index]);
            divUS(effectExponent, effectBase);
        }
        if (timeUpgradeLinearLevel[index] === 0) {
            writeNumber(effectBase, <f64>level);
            mulUS(effectExponent, effectBase);
        }
        writeNumber(effectBase, timeUpgradeEffects[index]);
        powInto(effectHandle, effectBase, effectExponent);
        if (timeUpgradeLinearLevel[index] !== 0) {
            writeNumber(effectBase, <f64>level);
            mulUS(effectHandle, effectBase);
        }
        return effectHandle;
    }
    if (timeUpgradePeriodSeconds[index] > 0) {
        copyInto(effectBase, time);
        writeNumber(effectExponent, timeUpgradePeriodSeconds[index]);
        divUS(effectBase, effectExponent);
        addUS(effectBase, 1);
    } else writeNumber(effectBase, 1);
    writeNumber(effectExponent, timeUpgradeEffects[index]);
    mulUS(effectBase, effectExponent);
    writeNumber(effectExponent, <f64>level);
    if (additive || timeUpgradeLinearLevel[index] !== 0) {
        copyInto(effectHandle, effectBase);
        mulUS(effectHandle, effectExponent);
    } else powInto(effectHandle, effectBase, effectExponent);
    return effectHandle;
}
export function timeUpgradeMultiplierHandle(type: i32): i32 {
    if (type < 0 || type > 5) {
        writeNumber(multiplierHandle, 1);
        return multiplierHandle;
    }
    writeNumber(multiplierHandle, 1);
    if (timeUpgradeOperations[type] === 0) mulUS(multiplierHandle, timeUpgradeEffectHandle(type));
    if (timeUpgradeOperations[type + 6] === 0) mulUS(multiplierHandle, timeUpgradeEffectHandle(type + 6));
    return multiplierHandle;
}
export function applyTimeUpgradePower(amount: i32, type: i32): void {
    if (type < 0 || type > 5) return;
    if (timeUpgradeOperations[type] === 1 && timeUpgradeLevels[type] > 0) powUS(amount, timeUpgradeEffectHandle(type));
    if (timeUpgradeOperations[type + 6] === 1 && timeUpgradeLevels[type + 6] > 0) powUS(amount, timeUpgradeEffectHandle(type + 6));
}
export function timeMemoryGain(base: i32): i32 {
    writeNumber(gainHandle, <f64>base);
    mulUS(gainHandle, timeUpgradeEffectHandle(3));
    addUS(gainHandle, timeUpgradeEffectHandle(9));
    if (getLayer(gainHandle) > 0 || getMagnitude(gainHandle) >= 1_000_000_000) return 1_000_000_000;
    return <i32>getMagnitude(gainHandle);
}
/** [/WASM] */

initializeTimeHandles(
    TIME_HANDLES.storedRealTime, TIME_HANDLES.storedGameTime, TIME_HANDLES.totalRealTime, TIME_HANDLES.totalGameTime,
    TIME_HANDLES.cost, TIME_HANDLES.costExponent, TIME_HANDLES.costGrowth,
    TIME_HANDLES.effect, TIME_HANDLES.effectExponent, TIME_HANDLES.effectBase, TIME_HANDLES.multiplier, TIME_HANDLES.gain,
    TIME_HANDLES.timePower, TIME_HANDLES.timePowerLog,
);

TIME_UPGRADES.forEach((upgrade, index) => initializeTimeUpgrade(
    index, createDecimal(...upgrade.cost), upgrade.costScaling.type === "polynomial" ? upgrade.costScaling.growth : 2, upgrade.costScaling.type === "squared",
    upgrade.effectPerLevel, upgrade.maxLevel, upgrade.currency === "real", upgrade.timeUnit === "year" ? 365 * 24 * 3600 : upgrade.timeUnit === "hour" ? 3600 : 0,
    upgrade.timeScaling === "proportional" ? 3 : upgrade.timeScaling === "logarithmic" ? 2 : upgrade.timeScaling === "exponential" ? 1 : 0,
    upgrade.operation === "add" ? 2 : upgrade.operation === "power" ? 1 : 0, upgrade.levelScaling === "linear", upgrade.logBase ?? 10, upgrade.logDivisor ?? 1, upgrade.dampenLog ?? false,
));
