import { addUS, clampToBoundary, copyInto, divInto, divUS, gt, gte, log10Into, lt, mulUS, pow10Into, powUS, subUS, writeNumber } from "../core/break_eternity.js";
import type { AbyssHandles } from "./handles.js";
import { hasMemoryMilestone } from "../game/memories.js";
import { unlockTierOneAchievement } from "../game/achievements.js";

declare const abyss: AbyssHandles;

/** [WASM] */

const ABYSS_MINIMUM_DEPTH: f64 = 1_000;
const ABYSS_TRAVEL_SPEED: f64 = 190;
const ABYSS_REWARD_START_DEPTH: f64 = 1_250;
const ABYSS_REWARD_AREA_SIZE: f64 = 250;
const ABYSS_REWARD_AREA_COUNT: i32 = 1_024;
const ABYSS_REWARDED_COMPLETIONS: i32 = 5;
const SONIC_LOGARITHMIC_LIMIT: f64 = 308.25471555991675;
const ABYSS_EFFECT_CYCLE_START: f64 = 7_750;
const ABYSS_EFFECT_CYCLE_LENGTH: f64 = 6_750;
let abyssDepth: f64 = ABYSS_MINIMUM_DEPTH;
let abyssMovement: i32 = 0;
let abyssRunActive = false;
let abyssRunDepth: f64 = ABYSS_MINIMUM_DEPTH;
let highestAbyssDepthCompleted: f64 = ABYSS_MINIMUM_DEPTH;
let abyssRunTime: f64 = 0;
let abyssRunsCompleted: i32 = 0;
let lastCompletedArea: i32 = -1;
let completionsInArea: i32 = 0;
const abyssAreaCompletions = new StaticArray<i32>(ABYSS_REWARD_AREA_COUNT);

export function getAbyssDepth(): f64 { return abyssDepth; }
export function setAbyssDepth(value: f64): void { abyssDepth = value < ABYSS_MINIMUM_DEPTH ? ABYSS_MINIMUM_DEPTH : value; }
export function abyssMinimumDepth(): f64 { return ABYSS_MINIMUM_DEPTH; }
export function setAbyssMovement(direction: i32): void { abyssMovement = direction < 0 ? -1 : direction > 0 ? 1 : 0; }
export function stopAbyssMovement(direction: i32): void { if (abyssMovement === direction) abyssMovement = 0; }
export function tickAbyssTraversal(deltaSeconds: f64): void {
    const nonnegativeDelta = deltaSeconds < 0 ? 0 : deltaSeconds;
    const limitedDelta = nonnegativeDelta > 0.05 ? 0.05 : nonnegativeDelta;
    const nextDepth = abyssDepth + abyssMovement * ABYSS_TRAVEL_SPEED * limitedDelta;
    abyssDepth = nextDepth < ABYSS_MINIMUM_DEPTH ? ABYSS_MINIMUM_DEPTH : nextDepth;
}

export function beginAbyssRun(): bool {
    if (abyssDepth <= ABYSS_MINIMUM_DEPTH || abyssRunActive) return false;
    abyssRunDepth = abyssDepth;
    abyssRunTime = 0;
    abyssRunActive = true;
    abyssMovement = 0;
    return true;
}

export function escapeAbyssRun(): bool {
    if (!abyssRunActive) return false;
    abyssRunActive = false;
    abyssRunTime = 0;
    return true;
}

export function isAbyssRunActive(): bool { return abyssRunActive; }
export function getAbyssRunDepth(): f64 { return abyssRunDepth; }
export function getAbyssRunTime(): f64 { return abyssRunTime; }
export function getHighestAbyssDepthCompleted(): f64 { return highestAbyssDepthCompleted; }
export function getAbyssRunsCompleted(): i32 { return abyssRunsCompleted; }
export function setAbyssRunTime(value: f64): void { abyssRunTime = value < 0 ? 0 : value; }
export function setHighestAbyssDepthCompleted(value: f64): void { highestAbyssDepthCompleted = value < ABYSS_MINIMUM_DEPTH ? ABYSS_MINIMUM_DEPTH : value; }
export function setAbyssRunsCompleted(value: i32): void { abyssRunsCompleted = value < 0 ? 0 : value; }
export function setAbyssRunActive(value: bool): void { abyssRunActive = value; }
export function setAbyssRunDepth(value: f64): void { abyssRunDepth = value < ABYSS_MINIMUM_DEPTH ? ABYSS_MINIMUM_DEPTH : value; }
export function getLastCompletedAbyssArea(): i32 { return lastCompletedArea; }
export function setLastCompletedAbyssArea(value: i32): void { lastCompletedArea = value; }
export function getAbyssAreaCompletions(): i32 { return completionsInArea; }
export function setAbyssAreaCompletions(value: i32): void {
    completionsInArea = value < 0 ? 0 : value;
    if (lastCompletedArea >= 0 && lastCompletedArea < ABYSS_REWARD_AREA_COUNT) {
        abyssAreaCompletions[lastCompletedArea] = completionsInArea > ABYSS_REWARDED_COMPLETIONS
            ? ABYSS_REWARDED_COMPLETIONS
            : completionsInArea;
    }
}
export function getAbyssRewardAreaCompletions(area: i32): i32 {
    if (area < 0 || area >= ABYSS_REWARD_AREA_COUNT) return 0;
    return abyssAreaCompletions[area];
}
export function setAbyssRewardAreaCompletions(area: i32, value: i32): void {
    if (area < 0 || area >= ABYSS_REWARD_AREA_COUNT) return;
    abyssAreaCompletions[area] = value < 0 ? 0 : value > ABYSS_REWARDED_COMPLETIONS ? ABYSS_REWARDED_COMPLETIONS : value;
}
export function tickAbyssRunTime(seconds: f64): void { if (abyssRunActive && seconds > 0) abyssRunTime += seconds; }

function writeDepthFactor(result: i32, depth: f64, threshold: f64): void {
    writeNumber(abyss.calculationB, depth);
    writeNumber(abyss.calculationC, threshold);
    divUS(abyss.calculationB, abyss.calculationC);
    log10Into(result, abyss.calculationB);
    writeNumber(abyss.calculationB, 2.302585092994046);
    mulUS(result, abyss.calculationB);
    if (hasMemoryMilestone(1_000)) {
        writeNumber(abyss.calculationB, 0.95);
        mulUS(result, abyss.calculationB);
    }
    addUS(result, 1);
}

function writeDirectDepthEffect(result: i32, depth: f64, threshold: f64, base: f64): void {
    if (depth < threshold) {
        writeNumber(result, 1);
        return;
    }
    writeDepthFactor(result, depth, threshold);
    writeNumber(abyss.calculationB, base);
    mulUS(result, abyss.calculationB);
}

function writeInverseDepthEffect(result: i32, depth: f64, threshold: f64, base: f64): void {
    if (depth < threshold) {
        writeNumber(result, 1);
        return;
    }
    writeDepthFactor(result, depth, threshold);
    copyInto(abyss.calculationC, result);
    writeNumber(result, base);
    divUS(result, abyss.calculationC);
}

function applyEffectRepeats(result: i32, index: i32, depth: f64, repeatBase: f64): void {
    const repeats = abyssEffectRepeats(index, depth);
    if (repeats === 0) return;
    writeNumber(abyss.calculationB, repeatBase);
    writeNumber(abyss.calculationC, repeats);
    powUS(abyss.calculationB, abyss.calculationC);
    mulUS(result, abyss.calculationB);
}

export function abyssProductionBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.productionPower, depth, 1_250, 0.2);
    return abyss.productionPower;
}

export function abyssProductionPowerHandle(depth: f64): i32 {
    abyssProductionBasePowerHandle(depth);
    applyEffectRepeats(abyss.productionPower, 0, depth, 0.001);
    return abyss.productionPower;
}

export function applyAbyssProductionEffect(amount: i32): void {
    if (!abyssRunActive) return;
    powUS(amount, abyssProductionPowerHandle(abyssRunDepth));
}

export function abyssGameSpeedDivisorHandle(): i32 {
    if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1);
    else {
        abyssGameSpeedBaseDivisorHandle(abyssRunDepth);
        applyEffectRepeats(abyss.sonicDivisor, 1, abyssRunDepth, 1_000);
    }
    return abyss.sonicDivisor;
}

export function abyssGameSpeedBaseDivisorHandle(depth: f64): i32 {
    writeDirectDepthEffect(abyss.sonicDivisor, depth, 1_750, 10);
    return abyss.sonicDivisor;
}

export function abyssMeditationPowerHandle(): i32 {
    if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1);
    else {
        abyssMeditationBasePowerHandle(abyssRunDepth);
        applyEffectRepeats(abyss.sonicDivisor, 2, abyssRunDepth, 0.001);
    }
    return abyss.sonicDivisor;
}

export function abyssMeditationBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.sonicDivisor, depth, 2_500, 0.25);
    return abyss.sonicDivisor;
}

export function abyssPotionPowerMultiplierHandle(): i32 {
    if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1);
    else {
        abyssPotionPowerBaseDivisorHandle(abyssRunDepth);
        applyEffectRepeats(abyss.sonicDivisor, 3, abyssRunDepth, 1_000);
        writeNumber(abyss.calculationA, 1);
        divInto(abyss.sonicDivisor, abyss.calculationA, abyss.sonicDivisor);
    }
    return abyss.sonicDivisor;
}

export function abyssPotionPowerBaseDivisorHandle(depth: f64): i32 {
    writeDirectDepthEffect(abyss.sonicDivisor, depth, 3_250, 100);
    return abyss.sonicDivisor;
}

export function abyssProgressionPowerHandle(): i32 {
    if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1);
    else {
        abyssProgressionBasePowerHandle(abyssRunDepth);
        applyEffectRepeats(abyss.sonicDivisor, 4, abyssRunDepth, 0.001);
    }
    return abyss.sonicDivisor;
}

export function abyssProgressionBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.sonicDivisor, depth, 4_000, 0.25);
    return abyss.sonicDivisor;
}

export function abyssProducerCostBasePowerHandle(depth: f64): i32 {
    writeDirectDepthEffect(abyss.sonicDivisor, depth, 4_750, 1.1);
    return abyss.sonicDivisor;
}

function abyssProducerCostPowerHandle(depth: f64): i32 {
    abyssProducerCostBasePowerHandle(depth);
    applyEffectRepeats(abyss.sonicDivisor, 5, depth, 1.1);
    return abyss.sonicDivisor;
}

export function abyssPurificationBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.sonicDivisor, depth, 5_500, 0.1);
    return abyss.sonicDivisor;
}

function abyssPurificationPowerHandle(depth: f64): i32 {
    abyssPurificationBasePowerHandle(depth);
    applyEffectRepeats(abyss.sonicDivisor, 6, depth, 0.1);
    return abyss.sonicDivisor;
}

export function abyssCourageBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.sonicDivisor, depth, 6_250, 0.1);
    return abyss.sonicDivisor;
}

function abyssCouragePowerHandle(depth: f64): i32 {
    abyssCourageBasePowerHandle(depth);
    applyEffectRepeats(abyss.sonicDivisor, 7, depth, 0.1);
    return abyss.sonicDivisor;
}

export function abyssCondenseBasePowerHandle(depth: f64): i32 {
    writeInverseDepthEffect(abyss.sonicDivisor, depth, 7_000, 0.1);
    return abyss.sonicDivisor;
}

function abyssCondensePowerHandle(depth: f64): i32 {
    abyssCondenseBasePowerHandle(depth);
    applyEffectRepeats(abyss.sonicDivisor, 8, depth, 0.1);
    return abyss.sonicDivisor;
}
export function abyssRunProducerCostPowerHandle(): i32 { if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1); else abyssProducerCostPowerHandle(abyssRunDepth); return abyss.sonicDivisor; }
export function abyssRunPurificationPowerHandle(): i32 { if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1); else abyssPurificationPowerHandle(abyssRunDepth); return abyss.sonicDivisor; }
export function abyssRunCouragePowerHandle(): i32 { if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1); else abyssCouragePowerHandle(abyssRunDepth); return abyss.sonicDivisor; }
export function abyssRunCondensePowerHandle(): i32 { if (!abyssRunActive) writeNumber(abyss.sonicDivisor, 1); else abyssCondensePowerHandle(abyssRunDepth); return abyss.sonicDivisor; }

export function abyssEffectStacks(index: i32, depth: f64): i32 {
    const thresholds = [1_250.0, 1_750.0, 2_500.0, 3_250.0, 4_000.0, 4_750.0, 5_500.0, 6_250.0, 7_000.0];
    if (depth < thresholds[index]) return 0;
    const repeatDepth = ABYSS_EFFECT_CYCLE_START + <f64>index * 750;
    return depth < repeatDepth ? 1 : 2 + <i32>((depth - repeatDepth) / ABYSS_EFFECT_CYCLE_LENGTH);
}

function abyssEffectRepeats(index: i32, depth: f64): i32 {
    const stacks = abyssEffectStacks(index, depth);
    return stacks > 1 ? stacks - 1 : 0;
}

function resonanceHandle(index: i32): i32 {
    switch (index) {
        case 0:
            return abyss.potionResonance;
        case 1:
            return abyss.matrixResonance;
        case 2:
            return abyss.meridianResonance;
        case 3:
            return abyss.meditationResonance;
        case 4:
            return abyss.memoryResonance;
        case 5:
            return abyss.condenseResonance;
        case 6:
            return abyss.purificationResonance;
        case 7:
            return abyss.courageResonance;
        default:
            return abyss.boostResonance;
    }
}

export function resonateTower(index: i32, fraction: f64): bool {
    if (!gt(abyss.sonicValue, 0)) return false;
    copyInto(abyss.sonicDrain, abyss.sonicValue);
    writeNumber(abyss.sonicDivisor, fraction < 0 ? 0 : fraction > 1 ? 1 : fraction);
    mulUS(abyss.sonicDrain, abyss.sonicDivisor);
    if (!gt(abyss.sonicDrain, 0)) return false;
    subUS(abyss.sonicValue, abyss.sonicDrain);
    addUS(resonanceHandle(index), abyss.sonicDrain);
    clampToBoundary(abyss.sonicValue, 0);
    clampToBoundary(resonanceHandle(index), 0);
    return true;
}

export function adjustTowerResonance(index: i32, amount: f64, withdraw: bool): bool {
    if (!isResonanceTowerUnlocked(index)) return false;
    const investment = resonanceHandle(index);
    const source = withdraw ? investment : abyss.sonicValue;
    const destination = withdraw ? abyss.sonicValue : investment;
    sonicLogarithmicValueHandle(source);
    if (!gt(abyss.logarithmicValue, 0)) return false;
    writeNumber(abyss.calculationA, amount < 0 ? 0 : amount);
    if (gt(abyss.calculationA, abyss.logarithmicValue)) copyInto(abyss.calculationA, abyss.logarithmicValue);
    copyInto(abyss.sonicDrain, abyss.calculationA);
    subUS(abyss.logarithmicValue, abyss.calculationA);
    writeSonicLogarithmicValue(source, abyss.logarithmicValue);
    sonicLogarithmicValueHandle(destination);
    addUS(abyss.logarithmicValue, abyss.sonicDrain);
    writeSonicLogarithmicValue(destination, abyss.logarithmicValue);
    if (gte(sonicValueLogarithmicHandle(), 1)) unlockTierOneAchievement(57);
    return true;
}

export function adjustTowerResonancePercent(index: i32, withdraw: bool): bool {
    const source = withdraw ? resonanceHandle(index) : abyss.sonicValue;
    sonicLogarithmicValueHandle(source);
    writeNumber(abyss.calculationA, 0.1);
    mulUS(abyss.logarithmicValue, abyss.calculationA);
    writeNumber(abyss.calculationA, 0.000001);
    if (lt(abyss.logarithmicValue, abyss.calculationA)) writeNumber(abyss.logarithmicValue, 0.000001);
    return adjustTowerResonanceHandle(index, abyss.logarithmicValue, withdraw);
}

function adjustTowerResonanceHandle(index: i32, requested: i32, withdraw: bool): bool {
    if (!isResonanceTowerUnlocked(index)) return false;
    const investment = resonanceHandle(index);
    const source = withdraw ? investment : abyss.sonicValue;
    const destination = withdraw ? abyss.sonicValue : investment;
    copyInto(abyss.calculationA, requested);
    sonicLogarithmicValueHandle(source);
    if (!gt(abyss.logarithmicValue, 0)) return false;
    if (gt(abyss.calculationA, abyss.logarithmicValue)) copyInto(abyss.calculationA, abyss.logarithmicValue);
    copyInto(abyss.sonicDrain, abyss.calculationA);
    subUS(abyss.logarithmicValue, abyss.calculationA);
    writeSonicLogarithmicValue(source, abyss.logarithmicValue);
    sonicLogarithmicValueHandle(destination);
    addUS(abyss.logarithmicValue, abyss.sonicDrain);
    writeSonicLogarithmicValue(destination, abyss.logarithmicValue);
    return true;
}

function sonicLogarithmicValueHandle(handle: i32): i32 {
    copyInto(abyss.logarithmicValue, handle);
    addUS(abyss.logarithmicValue, 1);
    log10Into(abyss.logarithmicValue, abyss.logarithmicValue);
    writeNumber(abyss.calculationC, SONIC_LOGARITHMIC_LIMIT);
    divUS(abyss.logarithmicValue, abyss.calculationC);
    if (lt(abyss.logarithmicValue, 0)) writeNumber(abyss.logarithmicValue, 0);
    writeNumber(abyss.calculationC, 1);
    if (gt(abyss.logarithmicValue, abyss.calculationC)) copyInto(abyss.logarithmicValue, abyss.calculationC);
    return abyss.logarithmicValue;
}

function writeSonicLogarithmicValue(handle: i32, value: i32): void {
    copyInto(abyss.calculationC, value);
    if (lt(abyss.calculationC, 0)) writeNumber(abyss.calculationC, 0);
    writeNumber(abyss.calculationB, 1);
    if (gt(abyss.calculationC, abyss.calculationB)) copyInto(abyss.calculationC, abyss.calculationB);
    writeNumber(abyss.calculationB, SONIC_LOGARITHMIC_LIMIT);
    mulUS(abyss.calculationC, abyss.calculationB);
    pow10Into(handle, abyss.calculationC);
    subUS(handle, 1);
}

export function resonanceInvestmentHandle(index: i32): i32 {
    return resonanceHandle(index);
}

export function resonanceInvestmentLogarithmicHandle(index: i32): i32 {
    return sonicLogarithmicValueHandle(resonanceHandle(index));
}

export function isResonanceTowerUnlocked(index: i32): bool {
    return index >= 0 && index < 9 && highestAbyssDepthCompleted >= 1_250 + <f64>index * 750;
}

export function resonanceTowerBonusHandle(index: i32): i32 {
    sonicLogarithmicValueHandle(resonanceHandle(index));
    if (!gt(abyss.logarithmicValue, 0)) {
        writeNumber(abyss.resonanceBonus, 1);
        return abyss.resonanceBonus;
    }
    copyInto(abyss.calculationA, abyss.logarithmicValue);
    writeNumber(abyss.calculationB, 30_102.99956639812);
    mulUS(abyss.calculationA, abyss.calculationB);
    if (hasMemoryMilestone(2_500)) {
        writeNumber(abyss.calculationB, 1.25);
        mulUS(abyss.calculationA, abyss.calculationB);
    }
    writeNumber(abyss.calculationB, index === 0 ? 0.26989700043360187 : 0.16989700043360187);
    addUS(abyss.calculationA, abyss.calculationB);
    pow10Into(abyss.resonanceBonus, abyss.calculationA);
    return abyss.resonanceBonus;
}

export function resonancePerBoostBonusHandle(): i32 {
    sonicLogarithmicValueHandle(resonanceHandle(8));
    if (!gt(abyss.logarithmicValue, 0)) {
        writeNumber(abyss.perBoostBonus, 0);
        return abyss.perBoostBonus;
    }
    copyInto(abyss.calculationA, abyss.logarithmicValue);
    if (hasMemoryMilestone(2_500)) {
        writeNumber(abyss.calculationB, 1.25);
        mulUS(abyss.calculationA, abyss.calculationB);
    }
    writeNumber(abyss.perBoostBonus, 750);
    powUS(abyss.perBoostBonus, abyss.calculationA);
    writeNumber(abyss.calculationB, 0.0125);
    mulUS(abyss.perBoostBonus, abyss.calculationB);
    writeNumber(abyss.calculationB, 0.5);
    if (gt(abyss.perBoostBonus, abyss.calculationB)) copyInto(abyss.perBoostBonus, abyss.calculationB);
    return abyss.perBoostBonus;
}

export function resonanceTowerEffectHandle(index: i32, power: f64): i32 {
    resonanceTowerBonusHandle(index);
    writeNumber(abyss.sonicDivisor, power);
    powUS(abyss.resonanceBonus, abyss.sonicDivisor);
    return abyss.resonanceBonus;
}

export function completeAbyssRun(): bool {
    if (!abyssRunActive) return false;
    const relativeDepth = abyssRunDepth - ABYSS_REWARD_START_DEPTH;
    const area = <i32>((relativeDepth + ABYSS_REWARD_AREA_SIZE - 0.000001) / ABYSS_REWARD_AREA_SIZE) - 1;
    lastCompletedArea = area;
    completionsInArea = area >= 0 && area < ABYSS_REWARD_AREA_COUNT ? abyssAreaCompletions[area] : 0;
    if (abyssRunDepth > ABYSS_REWARD_START_DEPTH && completionsInArea < ABYSS_REWARDED_COMPLETIONS) {
        completionsInArea++;
        if (area >= 0 && area < ABYSS_REWARD_AREA_COUNT) abyssAreaCompletions[area] = completionsInArea;
        writeNumber(abyss.calculationA, abyssRunDepth);
        writeNumber(abyss.calculationB, ABYSS_MINIMUM_DEPTH);
        subUS(abyss.calculationA, abyss.calculationB);
        writeNumber(abyss.calculationB, 0.00000012);
        mulUS(abyss.calculationA, abyss.calculationB);
        writeNumber(abyss.calculationB, 1);
        if (gt(abyss.calculationA, abyss.calculationB)) copyInto(abyss.calculationA, abyss.calculationB);
        writeSonicLogarithmicValue(abyss.sonicDrain, abyss.calculationA);
        writeNumber(abyss.sonicDivisor, completionsInArea);
        divUS(abyss.sonicDrain, abyss.sonicDivisor);
        addUS(abyss.sonicValue, abyss.sonicDrain);
        clampToBoundary(abyss.sonicValue, 0);
    }
    if (abyssRunDepth > highestAbyssDepthCompleted) highestAbyssDepthCompleted = abyssRunDepth;
    if (abyssRunDepth >= 1_250) unlockTierOneAchievement(55);
    if (abyssRunDepth >= 7_250) unlockTierOneAchievement(56);
    if (gte(sonicValueLogarithmicHandle(), 1)) unlockTierOneAchievement(57);
    if (abyssRunDepth >= 5_000) unlockTierOneAchievement(58);
    if (abyssRunDepth >= 10_000) unlockTierOneAchievement(59);
    if (abyssRunDepth >= ABYSS_EFFECT_CYCLE_START) unlockTierOneAchievement(48);
    abyssRunsCompleted++;
    abyssRunActive = false;
    return true;
}

export function sonicValueHandle(): i32 { return abyss.sonicValue; }

export function sonicValueLogarithmicHandle(): i32 {
    return sonicLogarithmicValueHandle(abyss.sonicValue);
}

/** [/WASM] */
