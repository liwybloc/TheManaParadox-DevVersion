import {
    addInto,
    addUS,
    clampToBoundary,
    copyInto,
    divUS,
    getLayer,
    getMagnitude,
    getSign,
    gt,
    log10Into,
    mulUS,
    reachesLayerBoundary,
    subUS,
    writeDecimal,
    writeNumber,
} from "../core/break_eternity.js";
import { checkManaAchievements, checkTimeAchievements } from "./achievements.js";
import { hasCondensedEffect } from "./condensed.js";
import { applyCrystal13ProductionDecay, applyCrystalManaGainModifiers, clampManaToActiveCrystalGoal, isAllMultipliersDisabledCrystalActive, isCrystalActive } from "./crystals.js";
import { hasMemoryMilestone, memoryManaMultiplierHandle, memoryProductionMultiplierHandle } from "./memories.js";
import { hasGuildShopUpgrade } from "../guild/guild.js";
import { equipmentManaProductionMultiplier } from "../guild/equipment.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { remembrance_manaGainModifiers } from "./remembrance.js";
import { applyAbyssProductionEffect, isAbyssRunActive } from "../abyss/abyss.js";

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const CONDENSE_LOG10_REQUIREMENT: f64 = 308.25471555991675;
const DECIMAL_FORMAT_BATCH_CAPACITY: i32 = 256;
const DECIMAL_FORMAT_COMPONENT_COUNT: i32 = 4;
const decimalFormatTransfer = new StaticArray<f64>(DECIMAL_FORMAT_BATCH_CAPACITY * DECIMAL_FORMAT_COMPONENT_COUNT);

export function decimalFormatTransferAddress(): usize {
    return changetype<usize>(decimalFormatTransfer);
}

export function decimalFormatTransferCapacity(): i32 {
    return DECIMAL_FORMAT_BATCH_CAPACITY;
}

export function writeDecimalFormatBatch(count: i32): void {
    if (count < 0 || count > DECIMAL_FORMAT_BATCH_CAPACITY) {
        throw new Error("Decimal format batch exceeds transfer capacity");
    }
    for (let index = count - 1; index >= 0; index--) {
        const handle = <i32>decimalFormatTransfer[index];
        const component = index * DECIMAL_FORMAT_COMPONENT_COUNT;
        decimalFormatTransfer[component] = getSign(handle);
        decimalFormatTransfer[component + 1] = getLayer(handle);
        decimalFormatTransfer[component + 2] = getMagnitude(handle);
        decimalFormatTransfer[component + 3] = isAtInfinityBoundary(handle) ? 1 : 0;
    }
}
const OOM_RATE_THRESHOLD: f64 = 40;

export function getIncType(): i32 {
    writeDecimal(scratch.productionModifier, 1, 1, OOM_RATE_THRESHOLD);
    return gt(player.mana, scratch.productionModifier) ? 1 : 0;
}

export function gainCurrency(currency: i32, amount: i32): void {
    gainCurrencyInternal(currency, amount, false);
}

export function gainProductionCurrency(currency: i32, amount: i32): void {
    gainCurrencyInternal(currency, amount, true);
}

function gainCurrencyInternal(currency: i32, amount: i32, trackProductionRate: bool): void {
    if (currency === player.mana) {
        copyInto(scratch.currencyGain, amount);
        
        applyManaGainModifiers(scratch.currencyGain);
        
        if (trackProductionRate) {
            copyInto(scratch.manaPerSecond, scratch.currencyGain);
            mulUS(scratch.manaPerSecond, scratch.updatesPerSecond);
            applyCrystal13ProductionDecay(scratch.manaPerSecond);
            divUS(scratch.manaPerSecond, scratch.updatesPerSecond);
            copyInto(scratch.currencyGain, scratch.manaPerSecond);
        }
        
        addUS(currency, scratch.currencyGain);
        
        if (!isCrystalActive()) addUS(player.statistics_totalManaProduced, scratch.currencyGain);
        if (trackProductionRate) {
            copyInto(scratch.manaPerSecond, scratch.currencyGain);
            mulUS(scratch.manaPerSecond, scratch.updatesPerSecond);
            writeNumber(scratch.oomPerSecond, 0);
            if (getIncType() === 1) {
                addInto(scratch.productionModifier, player.mana, scratch.manaPerSecond);
                log10Into(scratch.productionModifier, scratch.productionModifier);
                log10Into(scratch.oomPerSecond, player.mana);
                subUS(scratch.productionModifier, scratch.oomPerSecond);
                copyInto(scratch.oomPerSecond, scratch.productionModifier);
            }
        }
        
        clampManaToInfinityBoundary();
        
        if (!isCrystalActive()) updateHighestManaReached();
        else clampManaToActiveCrystalGoal();

        checkManaAchievements();
        return;
    }
    addUS(currency, amount);
}

export function updateHighestManaReached(): void {
    if (gt(player.mana, player.highestManaReached)) copyInto(player.highestManaReached, player.mana);
}

export function applyManaGainModifiers(amount: i32): void {
    if (isAllMultipliersDisabledCrystalActive()) return;
    mulUS(amount, player.multiplier_currencyGlobal);
    writeNumber(scratch.productionModifier, equipmentManaProductionMultiplier());
    mulUS(amount, scratch.productionModifier);
    if (hasMemoryMilestone(5)) mulUS(amount, memoryManaMultiplierHandle());
    if (hasGuildShopUpgrade(7)) mulUS(amount, 2);
    if (hasMemoryMilestone(25)) mulUS(amount, memoryProductionMultiplierHandle());
    if (hasMemoryMilestone(100) && isCrystalActive()) mulUS(amount, 10);
    if (hasCondensedEffect(13)) {
        writeNumber(scratch.productionModifier, 0);
        addUS(addUS(scratch.productionModifier, player.condensedMana), 1);
        mulUS(amount, scratch.productionModifier);
    }
    applyCrystalManaGainModifiers(amount);
    remembrance_manaGainModifiers(amount);
    applyAbyssProductionBeforeMeditation(amount);
}

function applyAbyssProductionBeforeMeditation(amount: i32): void {
    if (!isAbyssRunActive()) return;
    divUS(amount, player.castSpeedMagnitude);
    applyAbyssProductionEffect(amount);
    mulUS(amount, player.castSpeedMagnitude);
}

export function clampManaToInfinityBoundary(): void {
    clampToBoundary(player.mana, <i32>getMagnitude(player.mana_circle_tier));
}

export function isAtInfinityBoundary(value: i32): bool {
    return reachesLayerBoundary(value, <i32>getMagnitude(player.mana_circle_tier));
}

export function manaCondenseProgress(): f64 {
    if (reachesLayerBoundary(player.mana, 0)) return 1;
    if (!gt(player.mana, 1)) return 0;

    log10Into(scratch.currencyGain, player.mana);
    writeNumber(scratch.productionModifier, CONDENSE_LOG10_REQUIREMENT);
    divUS(scratch.currencyGain, scratch.productionModifier);
    if (!gt(scratch.currencyGain, 0)) return 0;
    if (gt(scratch.currencyGain, 1)) return 1;
    return getMagnitude(scratch.currencyGain);
}

export function manaGoalProgress(startExponent: f64, endExponent: f64, maximum: f64, doubleLog: bool): f64 {
    if (endExponent <= startExponent || !gt(player.mana, 1)) return 0;
    log10Into(scratch.currencyGain, player.mana);
    if (doubleLog) {
        if (!gt(scratch.currencyGain, 0)) return 0;
        log10Into(scratch.currencyGain, scratch.currencyGain);
        writeNumber(scratch.productionModifier, startExponent);
        if (gt(scratch.productionModifier, 0)) log10Into(scratch.productionModifier, scratch.productionModifier);
        writeNumber(scratch.tierOneSeconds, endExponent);
        log10Into(scratch.tierOneSeconds, scratch.tierOneSeconds);
    } else {
        writeNumber(scratch.productionModifier, startExponent);
        writeNumber(scratch.tierOneSeconds, endExponent);
    }
    subUS(scratch.currencyGain, scratch.productionModifier);
    subUS(scratch.tierOneSeconds, scratch.productionModifier);
    divUS(scratch.currencyGain, scratch.tierOneSeconds);
    if (!gt(scratch.currencyGain, 0)) return 0;
    writeNumber(scratch.productionModifier, maximum);
    if (gt(scratch.currencyGain, scratch.productionModifier)) return maximum;
    return getSign(scratch.currencyGain) * getMagnitude(scratch.currencyGain);
}

export function addPlayerTime(amount: i32): void {
    addUS(player.statistics_totalTimePlayed, amount);
    addCondenseTime(amount);
    checkTimeAchievements();
}

export function addCondenseTime(amount: i32): void {
    addUS(player.statistics_timeThisCondense, amount);
}

export function addGameTime(amount: i32): void {
    addUS(player.statistics_gameTimePlayed, amount);
    addUS(player.statistics_gameTimeThisCondense, amount);
    if (player.count_manaConduit === 0
        && player.count_conduitConjugation === 0
        && player.count_conjugationCreation === 0
        && player.count_creationManufactory === 0
        && player.count_manufactureStaff === 0) {
        copyInto(player.timeBeforeProducerBought, player.statistics_gameTimeThisCondense);
    }
}

export function cheatSomeCookies(): void {
    gainCurrency(player.mana, player.mana);
}

/** [/WASM] */
