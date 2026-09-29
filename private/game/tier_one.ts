import {
    addInto,
    addUS,
    copyInto,
    divInto,
    divUS,
    floorInto,
    gt,
    gte,
    log10Into,
    lte,
    multiplyInto,
    mulUS,
    passesLayerBoundary,
    pow10Into,
    powInto,
    powUS,
    subInto,
    subUS,
    toNumber,
    writeDecimal,
    writeNumber,
} from "../core/break_eternity.js";
import { hasTierOneAchievement, unlockTierOneAchievement } from "./achievements.js";
import { hasAscendedCondensedEffect, hasCondensedEffect } from "./condensed.js";
import { applyCrystalCostModifiers, applyCrystalMultModifiers, crystalEffectHandle, crystalRewardHandle, getActiveCrystal, hasCompletedCrystal, isAllMultipliersDisabledCrystalActive, isAllProducersManaAbsorbersCrystalActive, isCostGrowthCrystalActive, isCrossProducerCostCrystalActive, isCrossProducerMultiplierCrystalActive, isCrystalActive, isManaAbsorberOnlyCrystalActive, isProducerOnlyCrystalActive, isProductionDecayCrystalActive, isSpecificCrystalActive } from "./crystals.js";
import { applyManaGainModifiers } from "./currencies.js";
import { getTotalMemories, hasMemoryMilestone } from "./memories.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { remembrance_costScalingNerf } from "./remembrance.js";
import "../abyss/handles.js";
import { abyssRunProducerCostPowerHandle, abyssRunPurificationPowerHandle, resonancePerBoostBonusHandle, resonanceTowerEffectHandle } from "../abyss/abyss.js";

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

export const TIER_ONE_COUNT: i32 = 5;

// Effect = baseMultiplier * growthBase ^ ((log10(conduits) - startExponent) / exponentInterval)
// Next requirement = requirementMargin * 10 ^ (startExponent + exponentInterval * log_growthBase(currentEffect / baseMultiplier))
const PURIFICATION_BASE_MULTIPLIER: i32 = 16;
const PURIFICATION_GROWTH_BASE: f64 = 2.75;
const PURIFICATION_START_EXPONENT: i32 = 45;
const PURIFICATION_EXPONENT_INTERVAL: i32 = 10;
const PURIFICATION_REQUIREMENT_MARGIN: f64 = 1.01;
const PURIFICATION_MINIMUM_EFFECT: f64 = 1;
const PURIFICATION_SOFTCAP_MULTIPLIER: i32 = 350000;
const PURIFICATION_SOFTCAP_POWER: f64 = 0.5;
const CONDENSED_PRODUCER_MULTIPLIER: i32 = 2;
const CONDENSED_STAFF_MULTIPLIER: i32 = 5;

const EXPONENTIAL_COST_START_PURCHASES: i32 = 10000;
const EXPONENTIAL_COST_RATE: i32 = 1000;
const LOG10_E: f64 = 0.4342944819032518;
const LN_10: f64 = 2.302585092994046;

function exponentialCostStartPurchases(): i32 {
    return EXPONENTIAL_COST_START_PURCHASES + (hasMemoryMilestone(250) ? getTotalMemories() * 25 : 0);
}

export function refreshTierOneDerivedState(): void {
    writeNumber(scratch.expCostIncreasesAt, exponentialCostStartPurchases());
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        refreshTierOneCost(index);
        refreshTierOneMultiplier(index);
        refreshEmpowermentCost(index);
    }
    if (isCrossProducerMultiplierCrystalActive()) refreshCrossProducerMultipliers();
    if (isAllProducersManaAbsorbersCrystalActive() && getActiveCrystal() !== 14) synchronizeCrystal11Multipliers();
    refreshMeridianPurificationRequirement();
    refreshMeridianPurificationEffect();
}

export function refreshCrystalProducerCosts(): void {
    if (!isCostGrowthCrystalActive()) return;
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        refreshTierOneCost(index);
    }
}

export function refreshMeridianPurificationRequirement(): void {
    if (!gte(player.purifiedMeridiansMultiplier, PURIFICATION_BASE_MULTIPLIER)) {
        writeDecimal(player.meridianPurificationRequirement, 1, 1, PURIFICATION_START_EXPONENT);
        return;
    }
    divInto(scratch.tierOneExponent, player.purifiedMeridiansMultiplier, PURIFICATION_BASE_MULTIPLIER);
    if (hasTierOneAchievement(17)) divUS(scratch.tierOneExponent, 5);
    log10Into(scratch.tierOneExponent, scratch.tierOneExponent);
    writeNumber(scratch.productionModifier, PURIFICATION_GROWTH_BASE);
    log10Into(scratch.productionModifier, scratch.productionModifier);
    divUS(scratch.tierOneExponent, scratch.productionModifier);
    undoPurificationExponentSoftcap(scratch.tierOneExponent);
    addUS(
        mulUS(scratch.tierOneExponent, PURIFICATION_EXPONENT_INTERVAL),
        PURIFICATION_START_EXPONENT,
    );
    powInto(player.meridianPurificationRequirement, 10, scratch.tierOneExponent);
    writeNumber(scratch.tierOneExponent, PURIFICATION_REQUIREMENT_MARGIN);
    mulUS(player.meridianPurificationRequirement, scratch.tierOneExponent);
}

export function refreshMeridianPurificationEffect(): void {
    if (!gt(player.count_manaConduit, 0)) {
        writeNumber(player.meridianPurificationEffect, 1);
        return;
    }
    log10Into(scratch.tierOneExponent, player.count_manaConduit);
    divUS(subUS(scratch.tierOneExponent, PURIFICATION_START_EXPONENT), PURIFICATION_EXPONENT_INTERVAL);
    applyPurificationExponentSoftcap(scratch.tierOneExponent);
    writeNumber(scratch.productionModifier, PURIFICATION_GROWTH_BASE);
    powInto(player.meridianPurificationEffect, scratch.productionModifier, scratch.tierOneExponent);
    mulUS(player.meridianPurificationEffect, PURIFICATION_BASE_MULTIPLIER);
    if (hasTierOneAchievement(17)) mulUS(player.meridianPurificationEffect, 5);
    if (toNumber(player.meridianPurificationEffect) < PURIFICATION_MINIMUM_EFFECT) {
        writeNumber(player.meridianPurificationEffect, PURIFICATION_MINIMUM_EFFECT);
    }
    divInto(scratch.purificationRelativeIncrease, player.meridianPurificationEffect, player.purifiedMeridiansMultiplier);
}

export function effectivePurifiedMeridiansMultiplierHandle(): i32 {
    copyInto(scratch.tierOneProduction, player.purifiedMeridiansMultiplier);
    mulUS(scratch.tierOneProduction, resonanceTowerEffectHandle(6, 2));
    powUS(scratch.tierOneProduction, abyssRunPurificationPowerHandle());
    return scratch.tierOneProduction;
}

export function effectiveMeridianPurificationEffectHandle(): i32 {
    copyInto(scratch.currencyGain, player.meridianPurificationEffect);
    mulUS(scratch.currencyGain, resonanceTowerEffectHandle(6, 2));
    powUS(scratch.currencyGain, abyssRunPurificationPowerHandle());
    return scratch.currencyGain;
}

// Above ×350,000 total effect, exponent x follows threshold * (x / threshold)^0.5.
// The curve never decreases, but each additional exponent contributes progressively less.
function applyPurificationExponentSoftcap(exponent: i32): void {
    calculatePurificationSoftcapExponent(scratch.tierOneProduction);
    if (!gt(exponent, scratch.tierOneProduction)) return;
    divUS(exponent, scratch.tierOneProduction);
    writeNumber(scratch.productionModifier, PURIFICATION_SOFTCAP_POWER);
    powUS(exponent, scratch.productionModifier);
    mulUS(exponent, scratch.tierOneProduction);
}

function undoPurificationExponentSoftcap(exponent: i32): void {
    calculatePurificationSoftcapExponent(scratch.tierOneProduction);
    if (!gt(exponent, scratch.tierOneProduction)) return;
    divUS(exponent, scratch.tierOneProduction);
    powUS(exponent, 2);
    mulUS(exponent, scratch.tierOneProduction);
}

function calculatePurificationSoftcapExponent(result: i32): void {
    writeNumber(result, PURIFICATION_SOFTCAP_MULTIPLIER);
    divUS(result, PURIFICATION_BASE_MULTIPLIER);
    if (hasTierOneAchievement(17)) divUS(result, 5);
    log10Into(result, result);
    writeNumber(scratch.productionModifier, PURIFICATION_GROWTH_BASE);
    log10Into(scratch.productionModifier, scratch.productionModifier);
    divUS(result, scratch.productionModifier);
}

export function canPurifyMeridians(): bool {
    if (isProducerOnlyCrystalActive() || isManaAbsorberOnlyCrystalActive() || !hasTierOneAchievement(7)) return false;
    refreshMeridianPurificationRequirement();
    refreshMeridianPurificationEffect();
    return gte(player.count_manaConduit, player.meridianPurificationRequirement) && gt(player.meridianPurificationEffect, player.purifiedMeridiansMultiplier);
}

export function canPurifyMeridiansAtRelativeMultiplier(minimum: f64): bool {
    if (!canPurifyMeridians()) return false;
    writeNumber(scratch.tierOneSeconds, Math.max(1, minimum));
    return gte(scratch.purificationRelativeIncrease, scratch.tierOneSeconds);
}

export function canPurifyMeridiansAtRelativeMultiplierHandle(minimum: i32): bool {
    return canPurifyMeridians() && gte(scratch.purificationRelativeIncrease, minimum);
}

export function purifyMeridians(): bool {
    if (!canPurifyMeridians()) return false;
    copyInto(player.purifiedMeridiansMultiplier, player.meridianPurificationEffect);
    for (let index: i32 = 0; index < TIER_ONE_COUNT - 1; index++) {
        writeNumber(tierOneAmountHandle(index), 0);
    }
    refreshMeridianPurificationEffect();
    refreshMeridianPurificationRequirement();
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        refreshTierOneMultiplier(index);
    }
    return true;
}

export function canEmpowerTierOne(index: i32): bool {
    return !isSpecificCrystalActive(1) && !isProducerOnlyCrystalActive()
        && index >= 0 && index < TIER_ONE_COUNT - 1
        && gte(tierOneAmountHandle(index), tierOneEmpowermentCostHandle(index));
}

export function empowerTierOne(index: i32): bool {
    if (!canEmpowerTierOne(index)) return false;
    writeNumber(tierOneAmountHandle(index), 0);
    addUS(tierOneEmpowermentHandle(index), 1);
    if (gte(tierOneEmpowermentHandle(index), 2)) unlockTierOneAchievement(19);
    if (gte(tierOneEmpowermentHandle(index), 3)) unlockTierOneAchievement(41);
    refreshEmpowermentCost(index);
    refreshTierOneMultiplier(index);
    return true;
}

export function tierOneEmpowermentCostHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.cost_empowerment_manaConduit;
        case 1: return player.cost_empowerment_conduitConjugation;
        case 2: return player.cost_empowerment_conjugationCreation;
        case 3: return player.cost_empowerment_creationManufactory;
        case 4: return player.cost_empowerment_manufactureStaff;
        default: return 0;
    }
}

export function tierOneEmpowermentHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.empowerment_manaConduit;
        case 1: return player.empowerment_conduitConjugation;
        case 2: return player.empowerment_conjugationCreation;
        case 3: return player.empowerment_creationManufactory;
        case 4: return player.legacy_000;
        default: return 0;
    }
}

function refreshEmpowermentCost(index: i32): void {
    writeNumber(scratch.productionModifier, hasAscendedCondensedEffect(9) ? 1.8 : hasCondensedEffect(9) ? 1.9 : 2);
    powInto(scratch.tierOneExponent, scratch.productionModifier, tierOneEmpowermentHandle(index));
    mulUS(scratch.tierOneExponent, tierOneEmpowermentBaseExponent(index));
    powInto(tierOneEmpowermentCostHandle(index), 10, scratch.tierOneExponent);
}

function tierOneEmpowermentBaseExponent(index: i32): i32 {
    switch (index) {
        case 0: return 50;
        case 1: return 35;
        case 2: return 20;
        case 3: return 10;
        default: return 0;
    }
}

export function resetTierOneAmounts(): void {
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        writeNumber(tierOneAmountHandle(index), 0);
        writeNumber(tierOneBoughtHandle(index), 0);
    }
    refreshTierOneDerivedState();
}

export function resetMeridianPurification(): void {
    writeNumber(player.purifiedMeridiansMultiplier, 1);
    refreshMeridianPurificationRequirement();
    refreshMeridianPurificationEffect();
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        refreshTierOneMultiplier(index);
    }
}

export function buyTierOne(index: i32): bool {
    if (index < 0 || index >= TIER_ONE_COUNT || !isTierOneVisible(index)) return false;
    markProducerPurchaseStart();
    const cost = tierOneCostHandle(index);
    if (!gte(player.mana, cost)) return false;
    recordProducerBoost(index);
    subUS(player.mana, cost);
    addUS(tierOneAmountHandle(index), 1);
    addUS(tierOneBoughtHandle(index), 1);
    markCrystal13Purchase();
    unlockTierOneAchievement(index);
    markCrystal13Purchase();
    refreshTierOneCost(index);
    refreshTierOneMultiplier(index);
    if (isCrossProducerMultiplierCrystalActive() || isCrossProducerCostCrystalActive()) refreshTierOneDerivedState();
    return true;
}

export function buyAllTierOne(): void {
    for (let index: i32 = TIER_ONE_COUNT - 1; index >= 0; index--) buyTierOne(index);
}

export function buyMaxTierOne(index: i32): bool {
    if (index < 0 || index >= TIER_ONE_COUNT || !isTierOneVisible(index)) return false;
    markProducerPurchaseStart();
    const cost = tierOneCostHandle(index);
    if (!gte(player.mana, cost)) return false;
    recordProducerBoost(index);

    writeNumber(scratch.tierOneCostAcceleration, exponentialCostStartPurchases());
    if (gte(tierOneBoughtHandle(index), scratch.tierOneCostAcceleration)) {
        buyMaxTierOneAccelerated(index);
    } else {
        const scalingExponent = (<f64>(index + 1)) * remembrance_costScalingNerf();
        writeNumber(scratch.tierOneCostAcceleration, scalingExponent);
        powInto(scratch.tierOneSeconds, 10, scratch.tierOneCostAcceleration);
        subInto(scratch.productionModifier, scratch.tierOneSeconds, 1);
        multiplyInto(scratch.tierOneProduction, player.mana, scratch.productionModifier);
        addUS(divUS(scratch.tierOneProduction, cost), 1);
        log10Into(scratch.tierOneProduction, scratch.tierOneProduction);
        divUS(scratch.tierOneProduction, scratch.tierOneCostAcceleration);
        floorInto(scratch.tierOneExponent, scratch.tierOneProduction);
        if (!gt(scratch.tierOneExponent, 0)) writeNumber(scratch.tierOneExponent, 1);

        writeNumber(scratch.crystal13CostBoostTotal, exponentialCostStartPurchases());
        subUS(scratch.crystal13CostBoostTotal, tierOneBoughtHandle(index));
        if (gt(scratch.tierOneExponent, scratch.crystal13CostBoostTotal)) {
            copyInto(scratch.tierOneExponent, scratch.crystal13CostBoostTotal);
        }

        calculateTierOneBulkCost(cost);
        while (!lte(scratch.tierOneProduction, player.mana)) {
            subUS(scratch.tierOneExponent, 1);
            calculateTierOneBulkCost(cost);
        }
        subUS(player.mana, scratch.tierOneProduction);
        addUS(tierOneAmountHandle(index), scratch.tierOneExponent);
        addUS(tierOneBoughtHandle(index), scratch.tierOneExponent);

        writeNumber(scratch.crystal13CostBoostTotal, exponentialCostStartPurchases());
        if (gte(tierOneBoughtHandle(index), scratch.crystal13CostBoostTotal)) {
            refreshTierOneCost(index);
            if (gte(player.mana, cost)) buyMaxTierOneAccelerated(index);
        }
    }

    unlockTierOneAchievement(index);
    refreshTierOneCost(index);
    refreshTierOneMultiplier(index);
    if (isCrossProducerMultiplierCrystalActive() || isCrossProducerCostCrystalActive()) refreshTierOneDerivedState();
    return true;
}

function refreshCrossProducerMultipliers(): void {
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) applyCrystal12MultiplierEffect(index);
}

function buyMaxTierOneAccelerated(index: i32): void {
    const boughtHandle = tierOneBoughtHandle(index);

    log10Into(scratch.tierOneProduction, player.mana);
    divUS(scratch.tierOneProduction, abyssRunProducerCostPowerHandle());
    if (hasCompletedCrystal(13) && index < TIER_ONE_COUNT - 1) {
        writeNumber(scratch.crystal13CostPower, 0.9);
        log10Into(scratch.crystal13CostPower, scratch.crystal13CostPower);
        mulUS(scratch.crystal13CostPower, tierOneBoughtHandle(index + 1));
        subUS(scratch.tierOneProduction, scratch.crystal13CostPower);
    }
    if (isCrossProducerCostCrystalActive()) {
        crossProducerCostExponent(scratch.crystal13CostBoostTotal, index);
        subUS(scratch.tierOneProduction, scratch.crystal13CostBoostTotal);
    }
    computeTierOneBoughtCountForExponent(scratch.tierOneExponent, index, scratch.tierOneProduction);
    floorInto(scratch.tierOneExponent, scratch.tierOneExponent);
    if (!gte(scratch.tierOneExponent, boughtHandle)) copyInto(scratch.tierOneExponent, boughtHandle);

    computeTierOneCostExponent(scratch.productionModifier, index, scratch.tierOneExponent);
    powInto(scratch.tierOneProduction, 10, scratch.productionModifier);
    applyTierOneCostModifiers(scratch.tierOneProduction, index);
    while (gt(scratch.tierOneProduction, player.mana) && gte(scratch.tierOneExponent, boughtHandle)) {
        subUS(scratch.tierOneExponent, 1);
        computeTierOneCostExponent(scratch.productionModifier, index, scratch.tierOneExponent);
        powInto(scratch.tierOneProduction, 10, scratch.productionModifier);
        applyTierOneCostModifiers(scratch.tierOneProduction, index);
    }
    if (!gte(scratch.tierOneExponent, boughtHandle)) return;

    subUS(player.mana, scratch.tierOneProduction);
    addUS(scratch.tierOneExponent, 1);
    subUS(scratch.tierOneExponent, boughtHandle);
    addUS(tierOneAmountHandle(index), scratch.tierOneExponent);
    addUS(tierOneBoughtHandle(index), scratch.tierOneExponent);
    markCrystal13Purchase();
}

function recordProducerBoost(index: i32): void {
    if (index < TIER_ONE_COUNT - 1 && gt(tierOneBoughtHandle(index + 1), 0)) {
        player.boostedProducerThisCondense = true;
    }
}

function markProducerPurchaseStart(): void {
    if (!isCostGrowthCrystalActive()) return;
    if (gt(player.count_manaConduit, 0)
        || gt(player.count_conduitConjugation, 0)
        || gt(player.count_conjugationCreation, 0)
        || gt(player.count_creationManufactory, 0)
        || gt(player.count_manufactureStaff, 0)) return;
    copyInto(player.timeBeforeProducerBought, player.statistics_gameTimeThisCondense);
}

function markCrystal13Purchase(): void {
    if (isProductionDecayCrystalActive()) copyInto(player.timeBeforeProducerBought, player.statistics_gameTimeThisCondense);
}

export function buyMaxAllTierOne(): void {
    for (let index: i32 = TIER_ONE_COUNT - 1; index >= 0; index--) buyMaxTierOne(index);
}

function calculateTierOneBulkCost(cost: i32): void {
    powInto(scratch.tierOneProduction, scratch.tierOneSeconds, scratch.tierOneExponent);
    divUS(mulUS(subUS(scratch.tierOneProduction, 1), cost), scratch.productionModifier);
}

export function canBuyTierOne(index: i32): bool {
    return isTierOneVisible(index) && gte(player.mana, tierOneCostHandle(index));
}

export function tierOneAffordabilityProgress(index: i32): f64 {
    if (index < 0 || index >= TIER_ONE_COUNT) return 0;
    const cost = tierOneCostHandle(index);
    if (gte(player.mana, cost)) return 1;
    if (!gt(player.mana, 1)) return 0;
    const infinityBoundary = <i32>toNumber(player.mana_circle_tier);
    if (passesLayerBoundary(cost, infinityBoundary)) return 0;

    const bought = tierOneBoughtHandle(index);
    computeTierOneCostExponent(scratch.productionModifier, index, bought);
    if (gt(bought, 0)) {
        subInto(scratch.tierOneProduction, bought, 1);
        computeTierOneCostExponent(scratch.tierOneExponent, index, scratch.tierOneProduction);
    } else {
        writeNumber(scratch.tierOneExponent, 0);
    }

    if (isCrossProducerCostCrystalActive()) {
        writeNumber(scratch.crystal13CostBoostTotal, 0);
        for (let other: i32 = 0; other < TIER_ONE_COUNT; other++) {
            if (other !== index) addUS(scratch.crystal13CostBoostTotal, tierOneBoughtHandle(other));
        }
        if (gt(scratch.crystal13CostBoostTotal, 0)) {
            writeNumber(scratch.crystal13CostPower, 1.1);
            log10Into(scratch.crystal13CostPower, scratch.crystal13CostPower);
            mulUS(scratch.crystal13CostPower, scratch.crystal13CostBoostTotal);
            addUS(scratch.tierOneExponent, scratch.crystal13CostPower);
            addUS(scratch.productionModifier, scratch.crystal13CostPower);
        }
    }

    log10Into(scratch.tierOneProduction, player.mana);
    subUS(scratch.tierOneProduction, scratch.tierOneExponent);
    subUS(scratch.productionModifier, scratch.tierOneExponent);
    divUS(scratch.tierOneProduction, scratch.productionModifier);
    const progress = toNumber(scratch.tierOneProduction);
    return Math.max(0, Math.min(1, progress));
}

export function isTierOneVisible(index: i32): bool {
    if (isManaAbsorberOnlyCrystalActive()) return index === 0;
    return index === 0 || (index > 0 && index < TIER_ONE_COUNT && gt(tierOneBoughtHandle(index - 1), 0));
}

export function tierOneCostHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.cost_manaConduit;
        case 1: return player.cost_conduitConjugation;
        case 2: return player.cost_conjugationCreation;
        case 3: return player.cost_creationManufactory;
        case 4: return player.cost_manufactureStaff;
        default: return 0;
    }
}

export function tierOneMultiplierHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.multiplier_manaConduit;
        case 1: return player.multiplier_conduitConjugation;
        case 2: return player.multiplier_conjugationCreation;
        case 3: return player.multiplier_creationManufactory;
        case 4: return player.multiplier_manufactureStaff;
        default: return 0;
    }
}

export function tierOneDisplayMultiplierHandle(index: i32): i32 {
    multiplyInto(
        scratch.tierOneDisplayMultiplier,
        tierOneMultiplierHandle(index),
        player.castSpeedMagnitude,
    );
    if (index === 0) applyManaGainModifiers(scratch.tierOneDisplayMultiplier);
    if (index === 0) applyCrystal11ManaAbsorberReward(scratch.tierOneDisplayMultiplier);
    return scratch.tierOneDisplayMultiplier;
}

export function applyCrystal11ManaAbsorberReward(amount: i32): void {
    if (!hasCompletedCrystal(10)) return;
    writeNumber(scratch.crystal11CbrtExponent, 1 / 3);
    for (let index: i32 = 1; index < TIER_ONE_COUNT; index++) {
        if (!gt(tierOneMultiplierHandle(index), 1)) continue;
        copyInto(scratch.crystal11TemporaryMultiplier, tierOneMultiplierHandle(index));
        powUS(scratch.crystal11TemporaryMultiplier, scratch.crystal11CbrtExponent);
        mulUS(amount, scratch.crystal11TemporaryMultiplier);
    }
}

export function tierOneBoughtHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.bought_manaConduit;
        case 1: return player.bought_conduitConjugation;
        case 2: return player.bought_conjugationCreation;
        case 3: return player.bought_creationManufactory;
        case 4: return player.bought_manufactureStaff;
        default: return 0;
    }
}

function tierOneAmountHandle(index: i32): i32 {
    switch (index) {
        case 0: return player.count_manaConduit;
        case 1: return player.count_conduitConjugation;
        case 2: return player.count_conjugationCreation;
        case 3: return player.count_creationManufactory;
        case 4: return player.count_manufactureStaff;
        default: return 0;
    }
}

function refreshTierOneCost(index: i32): void {
    computeTierOneCostExponent(scratch.tierOneExponent, index, tierOneBoughtHandle(index));
    powInto(tierOneCostHandle(index), 10, scratch.tierOneExponent);
    applyTierOneCostModifiers(tierOneCostHandle(index), index);
}

function applyTierOneCostModifiers(cost: i32, index: i32): void {
    if (hasCompletedCrystal(13) && index < TIER_ONE_COUNT - 1) {
        writeNumber(scratch.crystal13CostPower, 0.9);
        powInto(scratch.crystal13CostPower, scratch.crystal13CostPower, tierOneBoughtHandle(index + 1));
        mulUS(cost, scratch.crystal13CostPower);
    }
    if (isCrossProducerCostCrystalActive()) {
        crossProducerCostExponent(scratch.crystal13CostBoostTotal, index);
        powInto(scratch.crystal13CostPower, 10, scratch.crystal13CostBoostTotal);
        mulUS(cost, scratch.crystal13CostPower);
    }
    applyCrystalCostModifiers(cost);
    powUS(cost, abyssRunProducerCostPowerHandle());
}

function crossProducerCostExponent(result: i32, index: i32): void {
    writeNumber(result, 0);
    for (let other: i32 = 0; other < TIER_ONE_COUNT; other++) {
        if (other !== index) addUS(result, tierOneBoughtHandle(other));
    }
}

// Writes log10(cost(boughtHandle)) into result. Through EXPONENTIAL_COST_START_PURCHASES this is the original linear formula; above it, the closed-form solution of the accelerating recurrence.
function computeTierOneCostExponent(result: i32, index: i32, boughtHandle: i32): void {
    const baseExponent = tierOneBaseCostExponent(index);
    const scalingExponent = (<f64>(index + 1)) * remembrance_costScalingNerf();
    writeNumber(scratch.tierOneCostAcceleration, scalingExponent);
    multiplyInto(result, boughtHandle, scratch.tierOneCostAcceleration);
    addUS(result, baseExponent);
    if (isSpecificCrystalActive(9)) return;
    writeNumber(scratch.tierOneCostAcceleration, exponentialCostStartPurchases());
    if (!gt(boughtHandle, scratch.tierOneCostAcceleration)) return;

    writeNumber(scratch.tierOneCostAcceleration, exponentialCostStartPurchases());
    subInto(result, boughtHandle, scratch.tierOneCostAcceleration);
    writeNumber(scratch.tierOneCostAcceleration, (scalingExponent / <f64>EXPONENTIAL_COST_RATE) * LOG10_E);
    multiplyInto(result, result, scratch.tierOneCostAcceleration);
    copyInto(scratch.tierOneSeconds, result);
    pow10Into(result, scratch.tierOneSeconds);
    subUS(result, 1);
    writeNumber(scratch.tierOneCostAcceleration, EXPONENTIAL_COST_RATE);
    multiplyInto(result, result, scratch.tierOneCostAcceleration);
    writeNumber(
        scratch.tierOneCostAcceleration,
        baseExponent + scalingExponent * exponentialCostStartPurchases(),
    );
    addUS(result, scratch.tierOneCostAcceleration);
}

// Inverse of computeTierOneCostExponent: writes the bought-count n such that E(n) == targetExponent.
function computeTierOneBoughtCountForExponent(result: i32, index: i32, targetExponent: i32): void {
    const baseExponent = tierOneBaseCostExponent(index);
    const scalingExponent = (<f64>(index + 1)) * remembrance_costScalingNerf();
    writeNumber(
        scratch.tierOneCostAcceleration,
        baseExponent + scalingExponent * exponentialCostStartPurchases(),
    );
    if (!gt(targetExponent, scratch.tierOneCostAcceleration) || isSpecificCrystalActive(9)) {
        subInto(result, targetExponent, baseExponent);
        writeNumber(scratch.tierOneCostAcceleration, scalingExponent);
        divUS(result, scratch.tierOneCostAcceleration);
        return;
    }

    subInto(result, targetExponent, scratch.tierOneCostAcceleration);
    writeNumber(scratch.tierOneCostAcceleration, EXPONENTIAL_COST_RATE);
    divInto(result, result, scratch.tierOneCostAcceleration);
    addUS(result, 1);
    log10Into(result, result);
    writeNumber(scratch.tierOneCostAcceleration, LN_10);
    multiplyInto(result, result, scratch.tierOneCostAcceleration);
    writeNumber(scratch.tierOneCostAcceleration, <f64>EXPONENTIAL_COST_RATE / scalingExponent);
    multiplyInto(result, result, scratch.tierOneCostAcceleration);
    writeNumber(scratch.tierOneCostAcceleration, exponentialCostStartPurchases());
    addUS(result, scratch.tierOneCostAcceleration);
}

function tierOneBaseCostExponent(index: i32): i32 {
    return isAllMultipliersDisabledCrystalActive() ? index + 1 : 1 << index;
}

function refreshTierOneMultiplier(index: i32): void {
    if (isAllMultipliersDisabledCrystalActive() && !(getActiveCrystal() === 14 && index === 0)) {
        writeNumber(tierOneMultiplierHandle(index), 1);
        return;
    }
    if (isSpecificCrystalActive(4)) {
        copyInto(scratch.productionModifier, crystalEffectHandle(4, 0));
    } else {
        writeNumber(scratch.productionModifier, 0);
        addUS(scratch.productionModifier, player.multiplier_tierOnePerPurchase);
        if (index === 0 && hasCondensedEffect(0)) {
            writeNumber(scratch.tierOneExponent, 0.1);
            addUS(scratch.productionModifier, scratch.tierOneExponent);
        }
        if (hasAscendedCondensedEffect(0)) {
            writeNumber(scratch.tierOneExponent, 0.25);
            addUS(scratch.productionModifier, scratch.tierOneExponent);
        }
        if (hasCompletedCrystal(4)) addUS(scratch.productionModifier, crystalRewardHandle(4, 0));
    }
    if (hasCompletedCrystal(11)) addUS(scratch.productionModifier, crystalRewardHandle(11, 0));
    addUS(scratch.productionModifier, resonancePerBoostBonusHandle());
    powInto(tierOneMultiplierHandle(index), scratch.productionModifier, tierOneBoughtHandle(index));
    if (index < TIER_ONE_COUNT - 1) {
        let empowermentMultiplier: f64 = hasAscendedCondensedEffect(16) ? 250 : hasCondensedEffect(16) ? 50 : 10;
        if (hasTierOneAchievement(41)) empowermentMultiplier *= 1.1;
        writeNumber(scratch.productionModifier, empowermentMultiplier);
        if (hasCompletedCrystal(1)) mulUS(scratch.productionModifier, crystalRewardHandle(1, 0));
        powInto(scratch.tierOneExponent, scratch.productionModifier, tierOneEmpowermentHandle(index));
        mulUS(tierOneMultiplierHandle(index), scratch.tierOneExponent);
    }
    mulUS(tierOneMultiplierHandle(index), effectivePurifiedMeridiansMultiplierHandle());
    if (index === 0 && hasCompletedCrystal(3)) {
        mulUS(tierOneMultiplierHandle(index), crystalRewardHandle(3, 0));
    }
    if (index === 0 && hasCompletedCrystal(8)) {
        addUS(tierOneMultiplierHandle(index), crystalRewardHandle(8, 0));
    }
    if (hasCompletedCrystal(12)) applyCrystal13Reward(tierOneMultiplierHandle(index));
    if (index === 4 && hasCondensedEffect(4)) {
        mulUS(tierOneMultiplierHandle(index), CONDENSED_STAFF_MULTIPLIER);
    } else if ((index === 0 && hasCondensedEffect(2))
        || (index === 1 && hasCondensedEffect(3))
        || (index === 2 && hasCondensedEffect(6))
        || (index === 3 && hasCondensedEffect(5))) {
        mulUS(tierOneMultiplierHandle(index), CONDENSED_PRODUCER_MULTIPLIER);
    }
    if (hasTierOneAchievement(15)) {
        writeNumber(scratch.tierOneExponent, 1 + <f64>(index + 1) / 100);
        mulUS(tierOneMultiplierHandle(index), scratch.tierOneExponent);
    }
    if (hasAscendedCondensedEffect(13)) {
        copyInto(scratch.productionModifier, player.condensedMana);
        addUS(scratch.productionModifier, 1);
        mulUS(tierOneMultiplierHandle(index), scratch.productionModifier);
    }
    if ((index === 0 && hasAscendedCondensedEffect(2))
        || (index === 1 && hasAscendedCondensedEffect(3))
        || (index === 2 && hasAscendedCondensedEffect(6))
        || (index === 3 && hasAscendedCondensedEffect(5))) {
        writeNumber(scratch.productionModifier, 1.1);
        powUS(tierOneMultiplierHandle(index), scratch.productionModifier);
    } else if (index === 4 && hasAscendedCondensedEffect(4)) {
        writeNumber(scratch.productionModifier, 1.25);
        powUS(tierOneMultiplierHandle(index), scratch.productionModifier);
    }
    applyCrystalMultModifiers(tierOneMultiplierHandle(index));
    if (isAllProducersManaAbsorbersCrystalActive() && getActiveCrystal() !== 14) synchronizeCrystal11Multipliers();
}

function applyCrystal13Reward(multiplier: i32): void {
    writeNumber(scratch.crystal13RewardPurchases, 0);
    for (let producer: i32 = 0; producer < TIER_ONE_COUNT; producer++) {
        addUS(scratch.crystal13RewardPurchases, tierOneBoughtHandle(producer));
    }
    if (lte(scratch.crystal13RewardPurchases, 0)) return;
    copyInto(scratch.crystal13RewardPower, crystalRewardHandle(12, 0));
    powUS(scratch.crystal13RewardPower, scratch.crystal13RewardPurchases);
    mulUS(multiplier, scratch.crystal13RewardPower);
}

function applyCrystal12MultiplierEffect(index: i32): void {
    if (!gt(tierOneMultiplierHandle(index), 1)) return;
    writeNumber(scratch.crystal12BoostTotal, 0);
    for (let producer: i32 = 0; producer < TIER_ONE_COUNT; producer++) {
        addUS(scratch.crystal12BoostTotal, tierOneBoughtHandle(producer));
    }
    subUS(scratch.crystal12BoostTotal, tierOneBoughtHandle(index));
    if (gt(scratch.crystal12BoostTotal, 0)) {;
        powInto(scratch.crystal12Power, scratch.D0_1, scratch.crystal12BoostTotal);
        mulUS(tierOneMultiplierHandle(index), scratch.crystal12Power);
    }
}

export function synchronizeCrystal11Multipliers(): void {
    copyInto(scratch.crystal11HighestMultiplier, tierOneMultiplierHandle(0));
    for (let index: i32 = 1; index < TIER_ONE_COUNT; index++) {
        if (gt(tierOneMultiplierHandle(index), scratch.crystal11HighestMultiplier)) {
            copyInto(scratch.crystal11HighestMultiplier, tierOneMultiplierHandle(index));
        }
    }
    for (let index: i32 = 0; index < TIER_ONE_COUNT; index++) {
        copyInto(tierOneMultiplierHandle(index), scratch.crystal11HighestMultiplier);
    }
}

/** [/WASM] */

refreshTierOneDerivedState();
