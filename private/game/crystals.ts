import { addUS, copyInto, createDecimal, createZero, divInto, divUS, getMagnitude, gte, multiplyInto, mulUS, powUS, subInto } from "../core/break_eternity.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { hasTierOneAchievement } from "./achievements.js";

export interface CrystalDefinition {
    readonly id: number;
    readonly color: string;
    readonly variant: number;
    readonly effects: readonly string[];
    readonly rewards: readonly string[];
    readonly possible?: boolean;
}

const CRYSTAL_GOAL_EXPONENTS = [
    1600, 4500, 450, 40, 200,
    95, 11200, 11000, 8.477121254719663, 24250,
    8600, 1200, 23000, 2400, 2100,
] as const;

export const CRYSTAL_GOALS: readonly i32[] = CRYSTAL_GOAL_EXPONENTS.map((exponent) =>
    createDecimal(1, 1, exponent)
);

export const CRYSTALS: readonly CrystalDefinition[] = [
    { id: 1,  color: "#a8f5ff", variant: 1, effects: ["Mana production is raised to ^0.9."], rewards: ["Mana production is ×10 stronger."] },
    { id: 2,  color: "#77ddff", variant: 2, effects: ["Empowerments are disabled", "Crystal Matrices are disabled"], rewards: ["Empowerments are buffed based on Crystal Matrices (×{empowermentCMBuff})"] },
    { id: 3,  color: "#49b7f2", variant: 3, effects: ["Only producers are enabled"], rewards: ["Unlock Memories"] },
    { id: 4,  color: "#2877d2", variant: 4, effects: ["Only Mana Absorbers are available", "Sealed Meridians and Crystal Matrix costs are modified", "Start with 10 mana"], rewards: ["Mana Absorbers are buffed based on Sealed Meridians (×{manaAbsorberSMBuff})"] },
    { id: 5,  color: "#173b91", variant: 5, effects: ["Per-boost multiplier is fixed to ×1.1"], rewards: ["Per-boost multiplier is increased by +0.05×"] },
    { id: 6,  color: "#422d83", variant: 1, effects: ["All multipliers are raised ^0.1", "Start with 10 mana"], rewards: ["×10 All Production"] },
    { id: 7,  color: "#78265f", variant: 2, effects: ["Potions are disabled"], rewards: ["Potions are ×1.5 stronger inside of crystals"] },
    { id: 8,  color: "#ae2d48", variant: 3, effects: ["Producer costs increase by ×100 each second of game time"], rewards: ["Raise the reward of Achievement 23 ^3"] },
    { id: 9,  color: "#dc3d32", variant: 4, effects: ["All multipliers are always ×1.00", "Game speed is always ×1.00", "Start with 11,111 mana", "Costs are slightly reduced"], rewards: ["Per-boost multiplier of Mana Absorbers is increased by +0.05×"] },
    { id: 10, color: "#eb612d", variant: 5, effects: ["Increase 25th Memory Milestone reward by a lot", "Prices do not increase exponentially past 10,000 purchases"], rewards: ["Increase 25th Memory Milestone reward"] },
    { id: 11, color: "#f1812e", variant: 1, effects: ["Producers only produce Mana Absorbers", "Multipliers are equal to the highest among producers"], rewards: ["All producer multipliers increase Mana Absorber's multiplier at a reduced rate"] },
    { id: 12, color: "#f5a83c", variant: 2, effects: ["Boosting each producer will modify the multipliers of other producers by ×0.1"], rewards: ["Per-boost multiplier is increased by +0.05×"] },
    { id: 13, color: "#f5c76f", variant: 3, effects: ["Production quickly drops towards ^0 and resets to ^1 when anything is purchased"], rewards: ["Gain a small boost to all multipliers after buying producers"] },
    { id: 14, color: "#fae5b5", variant: 4, effects: ["Buying any producer increases the cost of all other producers"], rewards: ["Buying any producer reduces the cost of the previous producer by ×0.9"] },
    { id: 15, color: "#ffffff", variant: 6, effects: ["Most effects of all previous crystals are applied"], rewards: ["Unlock the Abyss"] },
];

const unusedHandle = createZero();
const crystalEffectHandles = [
    // crystal 1 effects: mana production power
    createDecimal(1, 0, 0.9), unusedHandle, unusedHandle,
    // crystal 2 effects: disabled empowerments, disabled matrices, empowerment reward exponent
    createDecimal(1, 0, 1), createDecimal(1, 0, 1), createDecimal(1, 0, 0.1),
    // crystal 3 effects: producer-only restriction
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 4 effects: absorber-only restriction and modified progression costs, 10 for start mana
    createDecimal(1, 0, 10), unusedHandle, unusedHandle,
    // crystal 5 effects: fixed per-boost multiplier
    createDecimal(1, 0, 1.1), unusedHandle, unusedHandle,
    // crystal 6 effects: all multiplier power, 10 for start mana
    createDecimal(1, 0, 0.1), createDecimal(1, 0, 10), unusedHandle,
    // crystal 7 effects: potion use restriction without a decimal value
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 8 effects: cost growth per second of game time
    createDecimal(1, 0, 500), unusedHandle, unusedHandle,
    // crystal 9 effects: all multipliers disabled, 10 for start mana
    createDecimal(1, 0, 11111), unusedHandle, unusedHandle,
    // crystal 10 effects: memory-scaled mana multiplier base
    createDecimal(1, 0, 100), unusedHandle, unusedHandle,
    // crystal 11 effects: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 12 effects: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 13 effects: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 14 effects: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 15 effects: unused placeholders
    createDecimal(1, 0, 10), unusedHandle, unusedHandle,
];
const crystalRewardHandles = [
    // crystal 1 rewards: global mana production multiplier
    createDecimal(1, 0, 10), unusedHandle, unusedHandle,
    // crystal 2 rewards: matrix-scaled empowerment multiplier
    createZero(), unusedHandle, unusedHandle,
    // crystal 3 rewards: memory unlock without a decimal value
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 4 rewards: sealed-meridian-scaled absorber multiplier
    createZero(), unusedHandle, unusedHandle,
    // crystal 5 rewards: per-boost multiplier increase
    createDecimal(1, 0, 0.05), unusedHandle, unusedHandle,
    // crystal 6 rewards: global mana production multiplier
    createDecimal(1, 0, 10), unusedHandle, unusedHandle,
    // crystal 7 rewards: potion strength multiplier inside crystals
    createDecimal(1, 0, 1.5), unusedHandle, unusedHandle,
    // crystal 8 rewards: achievement 23 reward power
    createDecimal(1, 0, 3), unusedHandle, unusedHandle,
    // crystal 9 rewards: Mana Absorber per-boost multiplier increase
    createDecimal(1, 0, 0.05), unusedHandle, unusedHandle,
    // crystal 10 rewards: memory-scaled mana multiplier base
    createDecimal(1, 0, 25), unusedHandle, unusedHandle,
    // crystal 11 rewards: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 12 rewards: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 13 rewards: per-purchase multiplier boost
    createDecimal(1, 0, 1.01), unusedHandle, unusedHandle,
    // crystal 14 rewards: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
    // crystal 15 rewards: unused placeholders
    unusedHandle, unusedHandle, unusedHandle,
];

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const CRYSTAL_COUNT: i32 = 15;
const CRYSTAL_VALUE_COUNT: i32 = 3;
let activeCrystal: i32 = -1;
const completedCrystals = new StaticArray<u8>(CRYSTAL_COUNT);
const fastestCrystalShatters = new StaticArray<f64>(CRYSTAL_COUNT);
const possibleCrystals = new StaticArray<u8>(CRYSTAL_COUNT);
const crystalGoalHandles = new StaticArray<i32>(CRYSTAL_COUNT);
const effectHandles = new StaticArray<i32>(CRYSTAL_COUNT * CRYSTAL_VALUE_COUNT);
const rewardHandles = new StaticArray<i32>(CRYSTAL_COUNT * CRYSTAL_VALUE_COUNT);

export function initializeCrystal(
    index: i32,
    goalHandle: i32,
    possible: bool,
    effect0: i32,
    effect1: i32,
    effect2: i32,
    reward0: i32,
    reward1: i32,
    reward2: i32,
): void {
    crystalGoalHandles[index] = goalHandle;
    possibleCrystals[index] = possible ? 1 : 0;
    const offset = index * CRYSTAL_VALUE_COUNT;
    effectHandles[offset] = effect0;
    effectHandles[offset + 1] = effect1;
    effectHandles[offset + 2] = effect2;
    rewardHandles[offset] = reward0;
    rewardHandles[offset + 1] = reward1;
    rewardHandles[offset + 2] = reward2;
}

export function crystalGoalHandle(index: i32): i32 {
    return crystalGoalHandles[index];
}

export function crystalEffectHandle(index: i32, slot: i32): i32 {
    return effectHandles[index * CRYSTAL_VALUE_COUNT + slot];
}

export function crystalRewardHandle(index: i32, slot: i32): i32 {
    return rewardHandles[index * CRYSTAL_VALUE_COUNT + slot];
}

export function getActiveCrystal(): i32 {
    return activeCrystal;
}

export function setActiveCrystal(index: i32): void {
    activeCrystal = index >= 0 && index < CRYSTAL_COUNT ? index : -1;
}

export function isCrystalActive(): bool {
    return activeCrystal >= 0;
}

export function isSpecificCrystalActive(index: i32, or15: bool = true): bool {
    return activeCrystal === index || (or15 && activeCrystal === 14);
}

export function isProducerOnlyCrystalActive(): bool {
    return isSpecificCrystalActive(2);
}

export function isManaAbsorberOnlyCrystalActive(): bool {
    return isSpecificCrystalActive(3);
}

export function isPotionDisabledCrystalActive(): bool {
    return isSpecificCrystalActive(6);
}

export function isCostGrowthCrystalActive(): bool {
    return isSpecificCrystalActive(7, false);
}

export function isAllMultipliersDisabledCrystalActive(): bool {
    return isSpecificCrystalActive(8, false);
}

export function isAllProducersManaAbsorbersCrystalActive(): bool {
    return isSpecificCrystalActive(10);
}

export function isCrossProducerMultiplierCrystalActive(): bool {
    return isSpecificCrystalActive(11);
}

export function isProductionDecayCrystalActive(): bool {
    return isSpecificCrystalActive(12);
}

export function isCrossProducerCostCrystalActive(): bool {
    return isSpecificCrystalActive(13);
}

export function getCrystalStartMana(): i32 {
    if (!isCrystalActive()) return 0;
    switch (activeCrystal) {
        case 3: return crystalEffectHandle(3, 0);
        case 5: return crystalEffectHandle(5, 1);
        case 8: return crystalEffectHandle(8, 0);
        case 14: return crystalEffectHandle(14, 0);
        default: return 0;
    }
}

export function isCrystalUnlocked(index: i32): bool {
    return index === 0 || hasCompletedCrystal(index - 1);
}

export function enterCrystal(index: i32): bool {
    if (!isCrystalUnlocked(index) || isCrystalActive()) return false;
    activeCrystal = index;
    return true;
}

export function escapeCrystal(): bool {
    if (activeCrystal < 0) return false;
    activeCrystal = -1;
    return true;
}

export function hasCompletedCrystal(index: i32): bool {
    return completedCrystals[index] !== 0;
}

export function setCompletedCrystal(index: i32, completed: bool): void {
    completedCrystals[index] = completed ? 1 : 0;
}

export function getFastestCrystalShatter(index: i32): f64 {
    return fastestCrystalShatters[index];
}

export function setFastestCrystalShatter(index: i32, seconds: f64): void {
    fastestCrystalShatters[index] = Math.max(0, seconds);
}

export function isActiveCrystalGoalReached(): bool {
    return isCrystalActive() && gte(player.mana, crystalGoalHandle(activeCrystal));
}

export function clampManaToActiveCrystalGoal(): void {
    if (isCrystalActive() && possibleCrystals[activeCrystal] !== 0 && isActiveCrystalGoalReached()) {
        copyInto(player.mana, crystalGoalHandle(activeCrystal));
    }
}

export function canShatterActiveCrystal(): bool {
    return isCrystalActive()
        && possibleCrystals[activeCrystal] !== 0
        && isActiveCrystalGoalReached();
}

export function shatterActiveCrystal(): bool {
    if (!canShatterActiveCrystal()) return false;
    const elapsed = getMagnitude(player.statistics_timeThisCondense);
    const fastest = fastestCrystalShatters[activeCrystal];
    if (fastest <= 0 || elapsed < fastest) fastestCrystalShatters[activeCrystal] = elapsed;
    completedCrystals[activeCrystal] = 1;
    activeCrystal = -1;
    return true;
}

export function applyCrystalManaGainModifiers(amount: i32): void {
    if (isSpecificCrystalActive(0)) powUS(amount, crystalEffectHandle(0, 0));
    if (hasCompletedCrystal(0)) mulUS(amount, crystalRewardHandle(0, 0));
    if (hasCompletedCrystal(5)) mulUS(amount, crystalRewardHandle(5, 0));
}

export function applyCrystal13ProductionDecay(amount: i32): void {
    if (!isProductionDecayCrystalActive()) return;
    subInto(scratch.crystal13Elapsed, player.statistics_gameTimeThisCondense, player.timeBeforeProducerBought);
    addUS(scratch.crystal13Elapsed, 1);
    divInto(scratch.crystal13Power, 1, scratch.crystal13Elapsed);
    powUS(amount, scratch.crystal13Power);
}

export function applyCrystalMultModifiers(amount: i32): void {
    if (isSpecificCrystalActive(5)) powUS(amount, crystalEffectHandle(5, 0));
}

export function applyCrystalCostModifiers(cost: i32): void {
    if (isCrossProducerCostCrystalActive()) return;
    if (!isCostGrowthCrystalActive()) return;
    copyInto(scratch.productionModifier, crystalEffectHandle(7, 0));
    subInto(scratch.currencyGain, player.statistics_gameTimeThisCondense, player.timeBeforeProducerBought);
    powUS(scratch.productionModifier, scratch.currencyGain);
    mulUS(cost, scratch.productionModifier);
}

export function refreshCrystalRewardEffects(): void {
    copyInto(crystalRewardHandle(1, 0), player.matrixPower);
    if (hasTierOneAchievement(12)) addUS(crystalRewardHandle(1, 0), crystalEffectHandle(1, 2));
    multiplyInto(crystalRewardHandle(1, 0), crystalRewardHandle(1, 0), player.matrixOwned);
    mulUS(crystalRewardHandle(1, 0), 2);
    addUS(crystalRewardHandle(1, 0), 1);

    copyInto(crystalRewardHandle(3, 0), player.sealedMeridiansSpeedEffect);
    powUS(crystalRewardHandle(3, 0), 2);
}

/** [/WASM] */

for (let index = 0; index < CRYSTALS.length; index++) {
    const offset = index * 3;
    initializeCrystal(
        index,
        CRYSTAL_GOALS[index],
        CRYSTALS[index].possible ?? true,
        crystalEffectHandles[offset],
        crystalEffectHandles[offset + 1],
        crystalEffectHandles[offset + 2],
        crystalRewardHandles[offset],
        crystalRewardHandles[offset + 1],
        crystalRewardHandles[offset + 2],
    );
}
refreshCrystalRewardEffects();
